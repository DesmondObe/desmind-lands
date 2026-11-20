import type pg from "pg";
import { formatDay, formatKobo } from "../lib/format.ts";
import type { Email, Mailer } from "./mailer.ts";

type Row = { id: string; kind: string; payload: Record<string, any>; attempts: number };

const BATCH = 20;
const MAX_ATTEMPTS = 8;
const LEASE = "5 minutes";

// Everything an email about a deal might mention, in one query.
const DEAL_FACTS = `
  select d.id, d.stage, d.agreed_kobo::float8 as agreed_kobo, d.completion_date::text, d.cancel_reason,
         d.bank_name, d.bank_account_number, d.bank_account_name, d.cancelled_by,
         l.id as listing_id, l.title, l.town, l.state, l.price_kobo::float8 as price_kobo,
         s.id as seller_id, s.full_name as seller_name, s.email as seller_email,
         b.id as buyer_id, b.full_name as buyer_name, b.email as buyer_email
  from deals d
  join listings l on l.id = d.listing_id
  join users s on s.id = d.seller_id
  join users b on b.id = d.buyer_id`;

type Deal = Record<string, any>;

async function dealFacts(db: pg.Pool, dealId: string): Promise<Deal | undefined> {
  const { rows } = await db.query(`${DEAL_FACTS} where d.id = $1`, [dealId]);
  return rows[0];
}

const first = (name: string) => name.split(/\s+/)[0];
const land = (d: Deal) => `"${d.title}" in ${d.town}, ${d.state}`;

async function user(db: pg.Pool, id: string) {
  const { rows } = await db.query<{ email: string; full_name: string }>(
    "select email, full_name from users where id = $1",
    [id],
  );
  return rows[0];
}

/**
 * The emails an outbox event calls for. Runs on the system connection, which bypasses
 * row-level security: telling the other party about an offer means reading across the line.
 */
async function emailsFor(db: pg.Pool, row: Row, web: string): Promise<Email[]> {
  const p = row.payload;
  const dealUrl = (id: string) => `${web}/deals/${id}`;
  switch (row.kind) {
    case "welcome": {
      const u = await user(db, p.userId);
      if (!u) return [];
      return [
        {
          to: u.email,
          subject: "Welcome to DesMind Lands",
          text: `Hello ${first(u.full_name)},\n\nYour account is ready. On DesMind Lands, owners sell land directly to buyers: no agents, and no 5–10% commission taken from either side.\n\nTo sell, list your land with its photos and title documents; our team reviews every listing before it goes live. To buy, browse land on the market and make an offer. Each deal has its own room, where you agree terms, sign with witnesses and record every payment.\n\n${web}/dashboard`,
        },
      ];
    }
    case "password.reset": {
      const u = await user(db, p.userId);
      if (!u) return [];
      return [
        {
          to: u.email,
          subject: "Reset your password",
          text: `Hello ${first(u.full_name)},\n\nSomeone (we hope you) asked to reset the password of your DesMind Lands account. The link works for one hour:\n\n${web}/reset-password?token=${encodeURIComponent(p.token)}\n\nIf it was not you, ignore this email; your password stays as it is.`,
        },
      ];
    }
    case "listing.reviewed": {
      const { rows } = await db.query(
        `select l.id, l.title, l.status, l.review_note, u.email, u.full_name
         from listings l join users u on u.id = l.seller_id where l.id = $1`,
        [p.listingId],
      );
      const l = rows[0];
      if (!l) return [];
      return l.status === "published"
        ? [
            {
              to: l.email,
              subject: "Your land is on the market",
              text: `Hello ${first(l.full_name)},\n\n"${l.title}" has been reviewed and is now live on DesMind Lands. Buyers can see it and make offers; we will email you as each one arrives.\n\n${web}/lands/${l.id}`,
            },
          ]
        : [
            {
              to: l.email,
              subject: "Your listing needs changes",
              text: `Hello ${first(l.full_name)},\n\nOur team reviewed "${l.title}" and could not publish it yet.\n\n${l.review_note ? `What to change: ${l.review_note}\n\n` : ""}Make the changes and send it for review again from your dashboard.\n\n${web}/dashboard`,
            },
          ];
    }
    case "offer.made": {
      const { rows } = await db.query(
        "select deal_id, author_id, amount_kobo::float8 as amount, note from deal_offers where id = $1",
        [p.offerId],
      );
      const o = rows[0];
      if (!o) return [];
      const d = await dealFacts(db, o.deal_id);
      if (!d) return [];
      const fromSeller = o.author_id === d.seller_id;
      const [to, toName, from] = fromSeller
        ? [d.buyer_email, d.buyer_name, d.seller_name]
        : [d.seller_email, d.seller_name, d.buyer_name];
      return [
        {
          to,
          subject: `${fromSeller ? "Counter-offer" : "New offer"}: ${formatKobo(o.amount)} for ${d.title}`,
          text: `Hello ${first(toName)},\n\n${from} has offered ${formatKobo(o.amount)} for ${land(d)} (asking price ${formatKobo(d.price_kobo)}).${o.note ? `\n\nTheir note: "${o.note}"` : ""}\n\nAccept it, decline it, or make a counter-offer in the deal room:\n\n${dealUrl(d.id)}`,
        },
      ];
    }
    case "offer.answered": {
      const { rows } = await db.query(
        "select deal_id, author_id, amount_kobo::float8 as amount, status from deal_offers where id = $1",
        [p.offerId],
      );
      const o = rows[0];
      if (!o) return [];
      const d = await dealFacts(db, o.deal_id);
      if (!d) return [];
      const authorIsSeller = o.author_id === d.seller_id;
      const [to, toName, other] = authorIsSeller
        ? [d.seller_email, d.seller_name, d.buyer_name]
        : [d.buyer_email, d.buyer_name, d.seller_name];
      const accepted = o.status === "accepted";
      return [
        {
          to,
          subject: accepted ? `Offer accepted: ${d.title}` : `Offer declined: ${d.title}`,
          text: accepted
            ? `Hello ${first(toName)},\n\n${other} accepted ${formatKobo(o.amount)} for ${land(d)}. The land is now under offer.\n\nNext: the buyer inspects the land and does their checks, the seller gives the account to be paid into, and you agree a completion date. Then the agreement is prepared for both of you, and your witnesses, to sign.\n\n${dealUrl(d.id)}`
            : `Hello ${first(toName)},\n\n${other} declined your offer of ${formatKobo(o.amount)} for ${land(d)}. You can make another offer in the deal room.\n\n${dealUrl(d.id)}`,
        },
      ];
    }
    case "deal.message": {
      const { rows } = await db.query("select deal_id, author_id, body from deal_messages where id = $1", [
        p.messageId,
      ]);
      const m = rows[0];
      if (!m) return [];
      const d = await dealFacts(db, m.deal_id);
      if (!d) return [];
      // At most one message email per sender every 15 minutes: a chat is not a mailing list.
      const { rows: recent } = await db.query(
        `select 1 from deal_messages where deal_id = $1 and author_id = $2 and id <> $3
         and created_at > now() - interval '15 minutes' and created_at < (select created_at from deal_messages where id = $3)
         limit 1`,
        [m.deal_id, m.author_id, p.messageId],
      );
      if (recent.length) return [];
      const fromSeller = m.author_id === d.seller_id;
      const [to, toName, from] = fromSeller
        ? [d.buyer_email, d.buyer_name, d.seller_name]
        : [d.seller_email, d.seller_name, d.buyer_name];
      return [
        {
          to,
          subject: `Message from ${from} about ${d.title}`,
          text: `Hello ${first(toName)},\n\n${from} wrote:\n\n"${String(m.body).slice(0, 1500)}"\n\nReply in the deal room:\n\n${dealUrl(d.id)}`,
        },
      ];
    }
    case "deal.stage": {
      const d = await dealFacts(db, p.dealId);
      if (!d) return [];
      const both = (subject: string, body: string) =>
        [
          [d.seller_email, d.seller_name],
          [d.buyer_email, d.buyer_name],
        ].map(([to, name]) => ({ to, subject, text: `Hello ${first(name)},\n\n${body}\n\n${dealUrl(d.id)}` }));
      switch (p.stage) {
        case "agreement":
          return both(
            `Ready to sign: ${d.title}`,
            `The Contract of Sale for ${land(d)} at ${formatKobo(d.agreed_kobo)} is ready. Read it carefully, sign it, and name a witness to your signature. Your witness signs through a link; they need no account.`,
          );
        case "checks":
          return both(
            `Terms reopened: ${d.title}`,
            "The terms of your deal were reopened, so the agreement will be prepared again and signed afresh.",
          );
        case "payment":
          return both(
            `Signed and witnessed: ${d.title}`,
            `Everyone has signed. The buyer now pays the seller directly:\n\n  ${d.bank_name}\n  ${d.bank_account_number}\n  ${d.bank_account_name}\n\nThe buyer records each payment with its receipt; the seller confirms it arrived. Never pay into any other account, whoever asks.`,
          );
        case "paid":
          return both(
            `Paid in full: ${d.title}`,
            `The seller has confirmed receiving the full price of ${formatKobo(d.agreed_kobo)}. Next: the seller hands over the land and its original documents, and the buyer confirms receiving them.`,
          );
        case "handover":
          return [
            {
              to: d.buyer_email,
              subject: `Handover: ${d.title}`,
              text: `Hello ${first(d.buyer_name)},\n\n${d.seller_name} says they have handed over the land and its original documents. Once you have them, confirm it in the deal room to complete the sale.\n\n${dealUrl(d.id)}`,
            },
          ];
        case "completed":
          return both(
            `Sale complete: ${d.title}`,
            `Congratulations. The sale of ${land(d)} is complete, with no agent and no commission. Your signed agreement is in the deal room as a PDF. Remember to perfect the title: register the Deed of Assignment and obtain the Governor's Consent where the law requires it.`,
          );
        default:
          return [];
      }
    }
    case "deal.cancelled": {
      const d = await dealFacts(db, p.dealId);
      if (!d) return [];
      const bySeller = d.cancelled_by === d.seller_id;
      const byBuyer = d.cancelled_by === d.buyer_id;
      if (!bySeller && !byBuyer) return [];
      const [to, toName, by] = bySeller
        ? [d.buyer_email, d.buyer_name, d.seller_name]
        : [d.seller_email, d.seller_name, d.buyer_name];
      return [
        {
          to,
          subject: `Deal cancelled: ${d.title}`,
          text: `Hello ${first(toName)},\n\n${by} cancelled the deal for ${land(d)}.${d.cancel_reason ? `\n\nTheir reason: "${d.cancel_reason}"` : ""}\n\n${dealUrl(d.id)}`,
        },
      ];
    }
    case "witness.invited": {
      const { rows } = await db.query(
        "select deal_id, side, full_name, email from deal_witnesses where id = $1 and removed_at is null",
        [p.witnessId],
      );
      const w = rows[0];
      if (!w?.email || !p.token) return [];
      const d = await dealFacts(db, w.deal_id);
      if (!d) return [];
      const party = w.side === "seller" ? d.seller_name : d.buyer_name;
      return [
        {
          to: w.email,
          subject: `${party} has asked you to witness a land sale`,
          text: `Hello ${first(w.full_name)},\n\n${party} has named you as a witness to their signature on the sale of ${land(d)}, between ${d.seller_name} (seller) and ${d.buyer_name} (buyer)${d.agreed_kobo ? `, at ${formatKobo(d.agreed_kobo)}` : ""}.\n\nA witness confirms that the person signing is who they say they are, and signed of their own free will. Once the agreement is ready, read it and sign as witness here; you do not need an account:\n\n${web}/witness/${p.token}\n\nIf you do not know ${party}, or did not agree to be their witness, ignore this email.`,
        },
      ];
    }
    case "witness.signed": {
      const { rows } = await db.query("select deal_id, side, full_name from deal_witnesses where id = $1", [
        p.witnessId,
      ]);
      const w = rows[0];
      if (!w) return [];
      const d = await dealFacts(db, w.deal_id);
      if (!d) return [];
      const [to, name] = w.side === "seller" ? [d.seller_email, d.seller_name] : [d.buyer_email, d.buyer_name];
      return [
        {
          to,
          subject: `${w.full_name} has signed as your witness`,
          text: `Hello ${first(name)},\n\n${w.full_name} has signed the agreement for ${land(d)} as your witness.\n\n${dealUrl(d.id)}`,
        },
      ];
    }
    case "payment.declared": {
      const { rows } = await db.query(
        "select deal_id, amount_kobo::float8 as amount, method, reference, paid_on::text from deal_payments where id = $1",
        [p.paymentId],
      );
      const pay = rows[0];
      if (!pay) return [];
      const d = await dealFacts(db, pay.deal_id);
      if (!d) return [];
      return [
        {
          to: d.seller_email,
          subject: `Confirm a payment of ${formatKobo(pay.amount)}`,
          text: `Hello ${first(d.seller_name)},\n\n${d.buyer_name} says they paid you ${formatKobo(pay.amount)} by ${pay.method} on ${formatDay(pay.paid_on)}${pay.reference ? ` (reference ${pay.reference})` : ""}, for ${land(d)}.\n\nCheck your account, then confirm the payment arrived, or say it did not, in the deal room:\n\n${dealUrl(d.id)}`,
        },
      ];
    }
    case "payment.answered": {
      const { rows } = await db.query(
        "select deal_id, amount_kobo::float8 as amount, status, response_note from deal_payments where id = $1",
        [p.paymentId],
      );
      const pay = rows[0];
      if (!pay) return [];
      const d = await dealFacts(db, pay.deal_id);
      if (!d) return [];
      const ok = pay.status === "confirmed";
      return [
        {
          to: d.buyer_email,
          subject: ok
            ? `Payment confirmed: ${formatKobo(pay.amount)}`
            : `Payment not received: ${formatKobo(pay.amount)}`,
          text: ok
            ? `Hello ${first(d.buyer_name)},\n\n${d.seller_name} confirmed receiving ${formatKobo(pay.amount)} for ${land(d)}.\n\n${dealUrl(d.id)}`
            : `Hello ${first(d.buyer_name)},\n\n${d.seller_name} says the ${formatKobo(pay.amount)} you recorded has not arrived${pay.response_note ? `: "${pay.response_note}"` : "."}\n\nCheck with your bank, and talk it through in the deal room:\n\n${dealUrl(d.id)}`,
        },
      ];
    }
    default:
      return [];
  }
}

/** Claims a batch, sends what each event calls for, and marks it done (or schedules a retry). */
export async function drainOnce(db: pg.Pool, mailer: Mailer, webOrigin: string): Promise<number> {
  const web = webOrigin.replace(/\/$/, "");
  const { rows } = await db.query<Row>(
    `update outbox set run_after = now() + interval '${LEASE}', attempts = attempts + 1
     where id in (
       select id from outbox where processed_at is null and run_after <= now() and attempts < ${MAX_ATTEMPTS}
       order by id limit ${BATCH} for update skip locked)
     returning id, kind, payload, attempts`,
  );
  for (const row of rows) {
    try {
      for (const email of await emailsFor(db, row, web)) await mailer.send(email);
      // Secrets (reset and witness tokens) are not kept once their email has gone.
      await db.query(
        "update outbox set processed_at = now(), last_error = null, payload = payload - 'token' where id = $1",
        [row.id],
      );
    } catch (err) {
      const backoff = Math.min(2 ** row.attempts * 30, 6 * 3600);
      await db.query("update outbox set last_error = $2, run_after = now() + make_interval(secs => $3) where id = $1", [
        row.id,
        (err as Error).message.slice(0, 1000),
        backoff,
      ]);
      console.error(`outbox ${row.kind} #${row.id} failed (attempt ${row.attempts}):`, (err as Error).message);
    }
  }
  return rows.length;
}

/** Old sessions, used reset links and sent emails are cleared away. */
export async function sweep(db: pg.Pool) {
  await db.query("delete from sessions where expires_at < now()");
  await db.query("delete from password_resets where expires_at < now() - interval '1 day'");
  await db.query("delete from outbox where processed_at < now() - interval '30 days'");
}
