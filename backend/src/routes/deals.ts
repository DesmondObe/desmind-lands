import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { asUser, type Tx } from "../db/client.ts";
import {
  type DealSide,
  dealEvents,
  dealMessages,
  dealOffers,
  dealPayments,
  dealSignatures,
  deals,
  dealWitnesses,
  files,
  listings,
  users,
} from "../db/schema.ts";
import { agreementText, CHECKS, hashAgreement } from "../lib/agreement.ts";
import { forbidden, HttpError, notFound } from "../lib/errors.ts";
import { formatKobo, today } from "../lib/format.ts";
import { id, idParams, parse, requireUser } from "../lib/http.ts";
import { enqueue } from "../lib/outbox.ts";
import { agreementPdf } from "../lib/pdf.ts";
import { optionalPhoneField } from "../lib/phone.ts";
import { newSecret, sha256 } from "../lib/tokens.ts";

const kobo = z.coerce.number().int().positive("Enter an amount.").max(1e17);
const dealParams = z.object({ id });
const offerParams = z.object({ id, offerId: id });
const witnessParams = z.object({ id, witnessId: id });
const paymentParams = z.object({ id, paymentId: id });

const MAX_WITNESSES_PER_SIDE = 3;
// Every witness ever named by one side of one deal, removed ones included. Naming a witness
// sends an email from our domain to an address the user chose; without a ceiling, add-then-
// remove would turn that into a way to send as many as they liked.
const MAX_WITNESSES_NAMED_PER_SIDE = 10;

/** Names compared as people type them: case and extra spaces do not matter. */
const sameName = (a: string, b: string) =>
  a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();

type Party = { deal: typeof deals.$inferSelect; role: DealSide; me: { id: string; fullName: string } };

/** The deal, locked for this transaction, and which side of it the caller is on. */
async function party(tx: Tx, dealId: string, userId: string): Promise<Party> {
  const [deal] = await tx.select().from(deals).where(eq(deals.id, dealId)).for("update");
  if (!deal) throw notFound("Deal not found.");
  const role: DealSide | null = deal.sellerId === userId ? "seller" : deal.buyerId === userId ? "buyer" : null;
  if (!role) throw forbidden("Only the buyer and seller take part in a deal.");
  const [me] = await tx.select({ id: users.id, fullName: users.fullName }).from(users).where(eq(users.id, userId));
  return { deal, role, me: me! };
}

function atStage(p: Party, ...stages: (typeof deals.$inferSelect)["stage"][]) {
  if (!stages.includes(p.deal.stage)) {
    const what: Record<string, string> = {
      negotiating: "still being negotiated",
      checks: "at the checks stage",
      agreement: "at the signing stage",
      payment: "at the payment stage",
      completed: "completed",
      cancelled: "cancelled",
    };
    throw new HttpError(409, `This deal is ${what[p.deal.stage]}, so that cannot be done now.`);
  }
}

async function log(tx: Tx, p: Party, kind: string, summary: string) {
  await tx.insert(dealEvents).values({ dealId: p.deal.id, actorId: p.me.id, actorLabel: p.me.fullName, kind, summary });
}

const otherSide = (role: DealSide): DealSide => (role === "seller" ? "buyer" : "seller");

/** What the deal is waiting for, and whose move it is. Shown on the dashboard and the deal. */
export function nextStep(
  d: {
    stage: string;
    agreementReadyAt: string | null;
    paidAt: string | null;
    sellerHandoverAt: string | null;
    bankAccountNumber: string;
    completionDate: string | null;
  },
  facts: {
    openOfferBy: DealSide | null;
    signedParties: DealSide[];
    witnessSigned: Record<DealSide, boolean>;
    submittedPayments: number;
  },
): { who: DealSide | "both" | null; text: string } {
  switch (d.stage) {
    case "negotiating":
      return facts.openOfferBy
        ? { who: otherSide(facts.openOfferBy), text: "Answer the latest offer: accept, decline or counter." }
        : { who: "buyer", text: "Make an offer." };
    case "checks":
      if (!d.bankAccountNumber) return { who: "seller", text: "Add the bank account the buyer will pay into." };
      if (!d.completionDate) return { who: "both", text: "Agree a completion date." };
      return { who: "buyer", text: "Inspect the land and do your checks, then prepare the agreement." };
    case "agreement": {
      const missing: string[] = [];
      for (const side of ["seller", "buyer"] as const) {
        if (!facts.signedParties.includes(side)) missing.push(`the ${side} to sign`);
        if (!facts.witnessSigned[side]) missing.push(`a witness for the ${side}`);
      }
      return { who: "both", text: `Waiting for ${missing.join(", ")}.` };
    }
    case "payment":
      if (facts.submittedPayments) return { who: "seller", text: "Confirm the payment the buyer has recorded." };
      if (!d.paidAt) return { who: "buyer", text: "Pay the seller directly and record the payment with its receipt." };
      if (!d.sellerHandoverAt) return { who: "seller", text: "Hand over the land and its original documents." };
      return { who: "buyer", text: "Confirm you have received the land and its documents." };
    default:
      return { who: null, text: "" };
  }
}

/** Everything about a deal that the facts for nextStep need, for many deals at once. */
async function dealFacts(tx: Tx, dealIds: string[]) {
  const ids = `{${dealIds.join(",")}}`;
  const { rows } = await tx.execute<{
    deal_id: string;
    open_offer_by: DealSide | null;
    open_offer_kobo: number | null;
    signed: DealSide[] | null;
    seller_witness: boolean;
    buyer_witness: boolean;
    submitted: number;
    confirmed_kobo: number;
  }>(sql`
    select d.id as deal_id,
      (select case when o.author_id = d.seller_id then 'seller' else 'buyer' end
         from deal_offers o where o.deal_id = d.id and o.status = 'open') as open_offer_by,
      (select o.amount_kobo::float8 from deal_offers o where o.deal_id = d.id and o.status = 'open') as open_offer_kobo,
      (select array_agg(s.party::text) from deal_signatures s where s.deal_id = d.id and s.agreement_hash = d.agreement_hash) as signed,
      exists (select 1 from deal_witnesses w where w.deal_id = d.id and w.side = 'seller' and w.removed_at is null
              and w.signed_hash = d.agreement_hash) as seller_witness,
      exists (select 1 from deal_witnesses w where w.deal_id = d.id and w.side = 'buyer' and w.removed_at is null
              and w.signed_hash = d.agreement_hash) as buyer_witness,
      (select count(*)::int from deal_payments p where p.deal_id = d.id and p.status = 'submitted') as submitted,
      (select coalesce(sum(p.amount_kobo), 0)::float8 from deal_payments p where p.deal_id = d.id and p.status = 'confirmed') as confirmed_kobo
    from deals d where d.id = any(${ids}::uuid[])`);
  return new Map(
    rows.map((r) => [
      r.deal_id,
      {
        openOfferBy: r.open_offer_by,
        openOfferKobo: r.open_offer_kobo,
        signedParties: (r.signed ?? []) as DealSide[],
        witnessSigned: { seller: r.seller_witness, buyer: r.buyer_witness },
        submittedPayments: r.submitted,
        confirmedKobo: r.confirmed_kobo,
      },
    ]),
  );
}

function witnessLink(webOrigin: string, token: string) {
  return `${webOrigin.replace(/\/$/, "")}/witness/${token}`;
}

export async function dealRoutes(app: FastifyInstance) {
  /** A buyer's first offer on a piece of land opens the deal. */
  app.post("/listings/:id/deals", async (req, reply) => {
    const userId = requireUser(req);
    const { id: listingId } = parse(idParams, req.params);
    const body = parse(z.object({ amountKobo: kobo, note: z.string().trim().max(2000).default("") }), req.body);
    const deal = await asUser(app.db, userId, async (tx) => {
      const [l] = await tx.select().from(listings).where(eq(listings.id, listingId));
      if (!l) throw notFound("This land is not on the market.");
      if (l.sellerId === userId) throw new HttpError(409, "This is your own land.");
      if (l.status !== "published")
        throw new HttpError(
          409,
          l.status === "under_offer"
            ? "The seller has accepted another offer on this land."
            : "This land is not on the market.",
        );
      if (!l.negotiable && body.amountKobo !== l.priceKobo)
        throw new HttpError(422, `The seller has fixed the price at ${formatKobo(l.priceKobo)}.`);
      if (body.amountKobo > l.priceKobo * 2)
        throw new HttpError(422, "That offer is far above the asking price. Check the amount.");
      const { rows: open } = await tx.execute<{ id: string }>(
        sql`select id from deals where listing_id = ${listingId} and buyer_id = ${userId} and stage not in ('completed', 'cancelled')`,
      );
      if (open[0]) throw new HttpError(409, "You already have a deal open on this land.");
      const [d] = await tx.insert(deals).values({ listingId, sellerId: l.sellerId, buyerId: userId }).returning();
      const [o] = await tx
        .insert(dealOffers)
        .values({ dealId: d!.id, authorId: userId, amountKobo: body.amountKobo, note: body.note })
        .returning();
      const [me] = await tx.select({ fullName: users.fullName }).from(users).where(eq(users.id, userId));
      await tx.insert(dealEvents).values({
        dealId: d!.id,
        actorId: userId,
        actorLabel: me!.fullName,
        kind: "deal.opened",
        summary: `${me!.fullName} offered ${formatKobo(body.amountKobo)} for the land (asking ${formatKobo(l.priceKobo)}).`,
      });
      await enqueue(tx, { kind: "offer.made", payload: { offerId: o!.id } });
      return d!;
    });
    return reply.status(201).send({ deal: { id: deal.id } });
  });

  /** Every deal the caller is in, newest activity first, with whose move it is. */
  app.get("/me/deals", async (req) => {
    const userId = requireUser(req);
    return asUser(app.db, userId, async (tx) => {
      const rows = await tx
        .select({
          id: deals.id,
          stage: deals.stage,
          sellerId: deals.sellerId,
          buyerId: deals.buyerId,
          agreedKobo: deals.agreedKobo,
          agreementReadyAt: deals.agreementReadyAt,
          paidAt: deals.paidAt,
          sellerHandoverAt: deals.sellerHandoverAt,
          bankAccountNumber: deals.bankAccountNumber,
          completionDate: deals.completionDate,
          updatedAt: deals.updatedAt,
          createdAt: deals.createdAt,
          listingId: listings.id,
          title: listings.title,
          town: listings.town,
          state: listings.state,
          priceKobo: listings.priceKobo,
        })
        .from(deals)
        .innerJoin(listings, eq(listings.id, deals.listingId))
        .where(sql`${userId} in (${deals.sellerId}, ${deals.buyerId})`)
        .orderBy(desc(deals.updatedAt));
      const facts = await dealFacts(
        tx,
        rows.map((r) => r.id),
      );
      const names = new Map(
        (
          await tx
            .select({ id: users.id, fullName: users.fullName })
            .from(users)
            .where(
              sql`${users.id} = any(${`{${[...new Set(rows.flatMap((r) => [r.sellerId, r.buyerId]))].join(",")}}`}::uuid[])`,
            )
        ).map((u) => [u.id, u.fullName]),
      );
      return {
        deals: rows.map((r) => {
          const role: DealSide = r.sellerId === userId ? "seller" : "buyer";
          const f = facts.get(r.id)!;
          const step = nextStep(r, f);
          return {
            id: r.id,
            stage: r.stage,
            role,
            counterpart: names.get(role === "seller" ? r.buyerId : r.sellerId) ?? "",
            listing: { id: r.listingId, title: r.title, town: r.town, state: r.state, priceKobo: r.priceKobo },
            agreedKobo: r.agreedKobo,
            openOfferKobo: f.openOfferKobo,
            confirmedKobo: f.confirmedKobo,
            nextStep: step.text,
            yourMove: step.who === role || step.who === "both",
            updatedAt: r.updatedAt,
            createdAt: r.createdAt,
          };
        }),
      };
    });
  });

  /** The deal room: everything about one deal, for its two parties. */
  app.get("/deals/:id", async (req) => {
    const userId = requireUser(req);
    const { id: dealId } = parse(dealParams, req.params);
    return asUser(app.db, userId, async (tx) => {
      const [deal] = await tx.select().from(deals).where(eq(deals.id, dealId));
      if (!deal) throw notFound("Deal not found.");
      const role: DealSide | "admin" =
        deal.sellerId === userId ? "seller" : deal.buyerId === userId ? "buyer" : "admin";
      const [listing] = await tx.select().from(listings).where(eq(listings.id, deal.listingId));
      const people = await tx
        .select({ id: users.id, fullName: users.fullName, email: users.email, phone: users.phone })
        .from(users)
        .where(sql`${users.id} in (${deal.sellerId}, ${deal.buyerId})`);
      const seller = people.find((p) => p.id === deal.sellerId)!;
      const buyer = people.find((p) => p.id === deal.buyerId)!;
      const offers = await tx
        .select()
        .from(dealOffers)
        .where(eq(dealOffers.dealId, dealId))
        .orderBy(asc(dealOffers.createdAt));
      const messages = await tx
        .select()
        .from(dealMessages)
        .where(eq(dealMessages.dealId, dealId))
        .orderBy(asc(dealMessages.createdAt));
      const witnesses = await tx
        .select({
          id: dealWitnesses.id,
          side: dealWitnesses.side,
          fullName: dealWitnesses.fullName,
          email: dealWitnesses.email,
          phone: dealWitnesses.phone,
          address: dealWitnesses.address,
          occupation: dealWitnesses.occupation,
          signedName: dealWitnesses.signedName,
          signedAt: dealWitnesses.signedAt,
          current: sql<boolean>`${dealWitnesses.signedHash} is not distinct from ${deal.agreementHash ?? null} and ${dealWitnesses.signedHash} is not null`,
          createdAt: dealWitnesses.createdAt,
        })
        .from(dealWitnesses)
        .where(and(eq(dealWitnesses.dealId, dealId), isNull(dealWitnesses.removedAt)))
        .orderBy(asc(dealWitnesses.createdAt));
      const signatures = await tx
        .select({
          party: dealSignatures.party,
          signedName: dealSignatures.signedName,
          signedAt: dealSignatures.signedAt,
          agreementHash: dealSignatures.agreementHash,
        })
        .from(dealSignatures)
        .where(eq(dealSignatures.dealId, dealId));
      const payments = await tx
        .select()
        .from(dealPayments)
        .where(eq(dealPayments.dealId, dealId))
        .orderBy(asc(dealPayments.createdAt));
      const dealFiles = await tx
        .select({
          id: files.id,
          kind: files.kind,
          filename: files.filename,
          contentType: files.contentType,
          sizeBytes: files.sizeBytes,
          uploadedBy: files.uploadedBy,
          createdAt: files.createdAt,
        })
        .from(files)
        .where(and(eq(files.dealId, dealId), eq(files.ready, true)))
        .orderBy(asc(files.createdAt));
      const listingPapers = await tx
        .select({ id: files.id, kind: files.kind, filename: files.filename, contentType: files.contentType })
        .from(files)
        .where(and(eq(files.listingId, deal.listingId), eq(files.ready, true), sql`${files.kind} <> 'photo'`));
      const [cover] = await tx
        .select({ storageKey: files.storageKey, filename: files.filename })
        .from(files)
        .where(and(eq(files.listingId, deal.listingId), eq(files.kind, "photo"), eq(files.ready, true)))
        .orderBy(asc(files.position))
        .limit(1);
      const events = await tx
        .select()
        .from(dealEvents)
        .where(eq(dealEvents.dealId, dealId))
        .orderBy(asc(dealEvents.createdAt));
      const f = (await dealFacts(tx, [dealId])).get(dealId)!;
      const step = nextStep(deal, f);
      return {
        deal: { ...deal, agreementText: deal.agreementText },
        role,
        // What staff wrote to the seller in review, and which of them searched the title, are
        // not the buyer's to read.
        listing: role === "buyer" ? { ...listing!, reviewNote: "", titleSearchedBy: null, reviewedBy: null } : listing!,
        coverUrl: cover ? await app.storage.downloadUrl(cover.storageKey, cover.filename, true) : null,
        seller,
        buyer,
        offers,
        messages,
        witnesses,
        signatures: signatures.map((s) => ({ ...s, current: s.agreementHash === deal.agreementHash })),
        payments,
        files: dealFiles,
        listingPapers,
        events,
        checks: CHECKS,
        confirmedKobo: f.confirmedKobo,
        nextStep: { ...step, yours: step.who === role || step.who === "both" },
      };
    });
  });

  // --- Negotiation ---------------------------------------------------------------------------

  /** A counter-offer (or a new offer). Replaces any open offer. */
  app.post("/deals/:id/offers", async (req) => {
    const userId = requireUser(req);
    const { id: dealId } = parse(dealParams, req.params);
    const body = parse(z.object({ amountKobo: kobo, note: z.string().trim().max(2000).default("") }), req.body);
    await asUser(app.db, userId, async (tx) => {
      const p = await party(tx, dealId, userId);
      atStage(p, "negotiating");
      const [l] = await tx.select().from(listings).where(eq(listings.id, p.deal.listingId));
      if (l!.status !== "published") throw new HttpError(409, "The seller has accepted another offer on this land.");
      // As when the deal was opened: a fixed price takes only that price.
      if (!l!.negotiable && body.amountKobo !== l!.priceKobo)
        throw new HttpError(422, `The price of this land is fixed at ${formatKobo(l!.priceKobo)}.`);
      await tx
        .update(dealOffers)
        .set({ status: "superseded", respondedAt: sql`now()` })
        .where(and(eq(dealOffers.dealId, dealId), eq(dealOffers.status, "open")));
      const [o] = await tx
        .insert(dealOffers)
        .values({ dealId, authorId: userId, amountKobo: body.amountKobo, note: body.note })
        .returning();
      await tx.update(deals).set({ updatedAt: sql`now()` }).where(eq(deals.id, dealId));
      await log(tx, p, "offer.made", `${p.me.fullName} offered ${formatKobo(body.amountKobo)}.`);
      await enqueue(tx, { kind: "offer.made", payload: { offerId: o!.id } });
    });
    return { ok: true };
  });

  async function answerOffer(
    dealId: string,
    offerId: string,
    userId: string,
    action: "accept" | "decline" | "withdraw",
  ) {
    await asUser(app.db, userId, async (tx) => {
      const p = await party(tx, dealId, userId);
      atStage(p, "negotiating");
      const [o] = await tx
        .select()
        .from(dealOffers)
        .where(and(eq(dealOffers.id, offerId), eq(dealOffers.dealId, dealId)));
      if (!o || o.status !== "open") throw new HttpError(409, "This offer is no longer open.");
      const mine = o.authorId === userId;
      if (action === "withdraw" && !mine) throw forbidden("Only the person who made an offer can withdraw it.");
      if (action !== "withdraw" && mine) throw forbidden("The other party answers your offer.");
      if (action === "accept") {
        // One acceptance at a time per piece of land. Without this, two buyers accepting the
        // seller's counter-offers at the same moment both read "published" and both deals go
        // to checks. (An advisory lock, not FOR UPDATE: a buyer may not lock the seller's row.)
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${p.deal.listingId}::text, 0))`);
        const [l] = await tx.select().from(listings).where(eq(listings.id, p.deal.listingId));
        if (l!.status !== "published")
          throw new HttpError(409, "The seller has already accepted another offer on this land.");
        await tx
          .update(dealOffers)
          .set({ status: "accepted", respondedAt: sql`now()` })
          .where(eq(dealOffers.id, offerId));
        await tx
          .update(deals)
          .set({ stage: "checks", agreedKobo: o.amountKobo, agreedAt: sql`now()` })
          .where(eq(deals.id, dealId));
        await log(
          tx,
          p,
          "offer.accepted",
          `${p.me.fullName} accepted ${formatKobo(o.amountKobo)}. The land is now under offer while the buyer does their checks.`,
        );
        await tx.execute(sql`select app.sync_listing(${p.deal.listingId})`);
      } else {
        const status = action === "decline" ? "declined" : "withdrawn";
        await tx.update(dealOffers).set({ status, respondedAt: sql`now()` }).where(eq(dealOffers.id, offerId));
        await tx.update(deals).set({ updatedAt: sql`now()` }).where(eq(deals.id, dealId));
        await log(tx, p, `offer.${status}`, `${p.me.fullName} ${status} the offer of ${formatKobo(o.amountKobo)}.`);
      }
      if (action !== "withdraw") await enqueue(tx, { kind: "offer.answered", payload: { offerId } });
    });
    return { ok: true };
  }

  app.post("/deals/:id/offers/:offerId/accept", async (req) => {
    const { id: dealId, offerId } = parse(offerParams, req.params);
    return answerOffer(dealId, offerId, requireUser(req), "accept");
  });
  app.post("/deals/:id/offers/:offerId/decline", async (req) => {
    const { id: dealId, offerId } = parse(offerParams, req.params);
    return answerOffer(dealId, offerId, requireUser(req), "decline");
  });
  app.post("/deals/:id/offers/:offerId/withdraw", async (req) => {
    const { id: dealId, offerId } = parse(offerParams, req.params);
    return answerOffer(dealId, offerId, requireUser(req), "withdraw");
  });

  app.post("/deals/:id/messages", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req) => {
    const userId = requireUser(req);
    const { id: dealId } = parse(dealParams, req.params);
    const { body } = parse(z.object({ body: z.string().trim().min(1, "Write a message.").max(4000) }), req.body);
    await asUser(app.db, userId, async (tx) => {
      const p = await party(tx, dealId, userId);
      atStage(p, "negotiating", "checks", "agreement", "payment");
      const [m] = await tx.insert(dealMessages).values({ dealId, authorId: userId, body }).returning();
      await tx.update(deals).set({ updatedAt: sql`now()` }).where(eq(deals.id, dealId));
      await enqueue(tx, { kind: "deal.message", payload: { messageId: m!.id } });
    });
    return { ok: true };
  });

  // --- Checks and terms ----------------------------------------------------------------------

  /**
   * The terms the agreement will carry. The seller gives the bank account (they are paid into
   * it); the buyer ticks their own checks; either sets the inspection and completion dates
   * and the special terms, which each sees and can answer in the conversation.
   */
  app.patch("/deals/:id/terms", async (req) => {
    const userId = requireUser(req);
    const { id: dealId } = parse(dealParams, req.params);
    const body = parse(
      z.object({
        inspectionAt: z.iso.datetime({ offset: true }).nullable().optional(),
        inspectionNote: z.string().trim().max(1000).optional(),
        completionDate: z.iso.date().nullable().optional(),
        specialTerms: z.string().trim().max(4000).optional(),
        bankName: z.string().trim().max(80).optional(),
        bankAccountNumber: z
          .string()
          .trim()
          .regex(/^\d{10}$/, "A Nigerian account number (NUBAN) has 10 digits.")
          .optional(),
        bankAccountName: z.string().trim().max(120).optional(),
        checklist: z.partialRecord(z.enum(CHECKS.map((c) => c.key) as [string, ...string[]]), z.boolean()).optional(),
      }),
      req.body,
    );
    await asUser(app.db, userId, async (tx) => {
      const p = await party(tx, dealId, userId);
      atStage(p, "checks");
      const bank =
        body.bankName !== undefined || body.bankAccountNumber !== undefined || body.bankAccountName !== undefined;
      if (bank && p.role !== "seller") throw forbidden("Only the seller gives the account they are paid into.");
      if (body.checklist && p.role !== "buyer") throw forbidden("The checklist is the buyer's own.");
      if (bank && !(body.bankName && body.bankAccountNumber && body.bankAccountName))
        throw new HttpError(422, "Give the bank, the 10-digit account number and the account name.");
      if (body.completionDate && body.completionDate < today())
        throw new HttpError(422, "The completion date cannot be in the past.");
      await tx
        .update(deals)
        .set({
          ...(body.inspectionAt !== undefined ? { inspectionAt: body.inspectionAt } : {}),
          ...(body.inspectionNote !== undefined ? { inspectionNote: body.inspectionNote } : {}),
          ...(body.completionDate !== undefined ? { completionDate: body.completionDate } : {}),
          ...(body.specialTerms !== undefined ? { specialTerms: body.specialTerms } : {}),
          ...(bank
            ? {
                bankName: body.bankName!,
                bankAccountNumber: body.bankAccountNumber!,
                bankAccountName: body.bankAccountName!,
              }
            : {}),
          ...(body.checklist
            ? { checklist: { ...p.deal.checklist, ...body.checklist } as Record<string, boolean> }
            : {}),
        })
        .where(eq(deals.id, dealId));
      const said: string[] = [];
      if (body.inspectionAt) said.push("set the inspection date");
      if (body.completionDate) said.push("set the completion date");
      if (body.specialTerms !== undefined && body.specialTerms !== p.deal.specialTerms)
        said.push("changed the special terms");
      if (bank) said.push("gave the account for payment");
      if (body.checklist) {
        const done = Object.entries(body.checklist).filter(([k, v]) => v && !p.deal.checklist[k]);
        if (done.length) said.push(`ticked ${done.length} check${done.length > 1 ? "s" : ""}`);
      }
      if (said.length) await log(tx, p, "terms.updated", `${p.me.fullName} ${said.join(", ")}.`);
    });
    return { ok: true };
  });

  /** The buyer is satisfied: the agreement is written out and fixed for everyone to sign. */
  app.post("/deals/:id/agreement", async (req) => {
    const userId = requireUser(req);
    const { id: dealId } = parse(dealParams, req.params);
    await asUser(app.db, userId, async (tx) => {
      const p = await party(tx, dealId, userId);
      atStage(p, "checks");
      if (p.role !== "buyer") throw forbidden("The buyer prepares the agreement once satisfied with their checks.");
      const d = p.deal;
      if (!d.bankAccountNumber) throw new HttpError(422, "The seller has not yet given the account to pay into.");
      if (!d.completionDate) throw new HttpError(422, "Agree a completion date first.");
      if (!d.checklist.visited) throw new HttpError(422, "Visit the land in person before you agree to buy it.");
      const [l] = await tx.select().from(listings).where(eq(listings.id, d.listingId));
      const people = await tx
        .select({ id: users.id, fullName: users.fullName, email: users.email, phone: users.phone })
        .from(users)
        .where(sql`${users.id} in (${d.sellerId}, ${d.buyerId})`);
      const text = agreementText({
        dealId: d.id,
        seller: people.find((x) => x.id === d.sellerId)!,
        buyer: people.find((x) => x.id === d.buyerId)!,
        listing: l!,
        agreedKobo: d.agreedKobo!,
        completionDate: d.completionDate,
        bank: { name: d.bankName, accountNumber: d.bankAccountNumber, accountName: d.bankAccountName },
        specialTerms: d.specialTerms,
        preparedOn: new Date().toISOString(),
      });
      await tx
        .update(deals)
        .set({
          stage: "agreement",
          agreementText: text,
          agreementHash: hashAgreement(text),
          agreementReadyAt: sql`now()`,
        })
        .where(eq(deals.id, dealId));
      await log(tx, p, "agreement.prepared", `${p.me.fullName} prepared the agreement. It is ready to sign.`);
      await enqueue(tx, { kind: "deal.stage", payload: { dealId, stage: "agreement" } });
    });
    return { ok: true };
  });

  /** Either party wants to change a term: back to checks, and every signature so far lapses. */
  app.post("/deals/:id/revise", async (req) => {
    const userId = requireUser(req);
    const { id: dealId } = parse(dealParams, req.params);
    const { reason } = parse(
      z.object({ reason: z.string().trim().min(3, "Say what needs to change.").max(1000) }),
      req.body,
    );
    await asUser(app.db, userId, async (tx) => {
      const p = await party(tx, dealId, userId);
      atStage(p, "agreement");
      await tx.delete(dealSignatures).where(eq(dealSignatures.dealId, dealId));
      await tx
        .update(deals)
        .set({ stage: "checks", agreementText: null, agreementHash: null, agreementReadyAt: null })
        .where(eq(deals.id, dealId));
      await log(
        tx,
        p,
        "agreement.revised",
        `${p.me.fullName} reopened the terms: “${reason}”. Signatures so far have lapsed.`,
      );
      await enqueue(tx, { kind: "deal.stage", payload: { dealId, stage: "checks" } });
    });
    return { ok: true };
  });

  app.post("/deals/:id/sign", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req) => {
    const userId = requireUser(req);
    const { id: dealId } = parse(dealParams, req.params);
    const body = parse(
      z.object({
        signedName: z.string().trim().min(3).max(120),
        agreementHash: z.string().length(64),
        consent: z.literal(true, { error: "Tick the box to confirm you have read and agree to the agreement." }),
      }),
      req.body,
    );
    await asUser(app.db, userId, async (tx) => {
      const p = await party(tx, dealId, userId);
      atStage(p, "agreement");
      if (body.agreementHash !== p.deal.agreementHash)
        throw new HttpError(409, "The agreement has changed since you opened it. Read it again before signing.");
      if (!sameName(body.signedName, p.me.fullName))
        throw new HttpError(422, `Type your full name exactly as it is on your account: ${p.me.fullName}.`);
      const done = await tx
        .select({ id: dealSignatures.id })
        .from(dealSignatures)
        .where(and(eq(dealSignatures.dealId, dealId), eq(dealSignatures.party, p.role)));
      if (done.length) throw new HttpError(409, "You have already signed this agreement.");
      await tx.insert(dealSignatures).values({
        dealId,
        party: p.role,
        userId,
        signedName: body.signedName,
        agreementHash: body.agreementHash,
        ip: req.ip,
        userAgent: (req.headers["user-agent"] ?? "").slice(0, 300),
      });
      await log(tx, p, "agreement.signed_party", `${p.me.fullName} signed the agreement as the ${p.role}.`);
      await tx.execute(sql`select app.advance_if_signed(${dealId})`);
    });
    return { ok: true };
  });

  // --- Witnesses -----------------------------------------------------------------------------

  /** Names a witness to the caller's own signature and returns the link they sign through. */
  app.post("/deals/:id/witnesses", async (req, reply) => {
    const userId = requireUser(req);
    const { id: dealId } = parse(dealParams, req.params);
    const body = parse(
      z.object({
        fullName: z
          .string()
          .trim()
          .min(3)
          .max(120)
          .refine((v) => v.split(/\s+/).length >= 2, "Give the witness's full name."),
        email: z.union([z.email("Enter a valid email address.").max(254), z.literal("")]).default(""),
        phone: optionalPhoneField("Phone"),
      }),
      req.body,
    );
    const token = newSecret();
    const witness = await asUser(app.db, userId, async (tx) => {
      const p = await party(tx, dealId, userId);
      atStage(p, "checks", "agreement");
      if (!body.email && !body.phone)
        throw new HttpError(422, "Give the witness's email or phone, so they can be reached.");
      const others = await tx
        .select({ id: dealWitnesses.id, fullName: dealWitnesses.fullName })
        .from(dealWitnesses)
        .where(and(eq(dealWitnesses.dealId, dealId), eq(dealWitnesses.side, p.role), isNull(dealWitnesses.removedAt)));
      if (others.length >= MAX_WITNESSES_PER_SIDE)
        throw new HttpError(409, `Each side can have up to ${MAX_WITNESSES_PER_SIDE} witnesses.`);
      const { rows: named } = await tx.execute<{ n: number }>(
        sql`select count(*)::int as n from deal_witnesses where deal_id = ${dealId} and side = ${p.role}`,
      );
      if ((named[0]?.n ?? 0) >= MAX_WITNESSES_NAMED_PER_SIDE)
        throw new HttpError(
          429,
          "You have named and removed witnesses too many times on this deal. Write to us and we will help.",
        );
      // A witness is independent: neither party can witness the deal.
      const [seller] = await tx.select({ n: users.fullName }).from(users).where(eq(users.id, p.deal.sellerId));
      const [buyer] = await tx.select({ n: users.fullName }).from(users).where(eq(users.id, p.deal.buyerId));
      if (sameName(body.fullName, seller!.n) || sameName(body.fullName, buyer!.n))
        throw new HttpError(422, "The buyer and seller cannot witness their own deal. Choose someone else.");
      const [w] = await tx
        .insert(dealWitnesses)
        .values({
          dealId,
          side: p.role,
          invitedBy: userId,
          fullName: body.fullName,
          email: body.email.toLowerCase(),
          phone: body.phone,
          tokenHash: sha256(token),
        })
        .returning({ id: dealWitnesses.id });
      await log(tx, p, "witness.added", `${p.me.fullName} named ${body.fullName} as the ${p.role}'s witness.`);
      if (body.email) await enqueue(tx, { kind: "witness.invited", payload: { witnessId: w!.id, token } });
      return w!;
    });
    return reply.status(201).send({ witness, link: witnessLink(app.config.WEB_ORIGIN, token) });
  });

  /** A fresh link for a witness (the old one stops working), to send again by WhatsApp or SMS. */
  app.post("/deals/:id/witnesses/:witnessId/link", async (req) => {
    const userId = requireUser(req);
    const { id: dealId, witnessId } = parse(witnessParams, req.params);
    const token = newSecret();
    await asUser(app.db, userId, async (tx) => {
      const p = await party(tx, dealId, userId);
      atStage(p, "checks", "agreement");
      const updated = await tx
        .update(dealWitnesses)
        .set({ tokenHash: sha256(token) })
        .where(
          and(
            eq(dealWitnesses.id, witnessId),
            eq(dealWitnesses.dealId, dealId),
            eq(dealWitnesses.side, p.role),
            isNull(dealWitnesses.removedAt),
          ),
        )
        .returning({ email: dealWitnesses.email });
      if (!updated.length) throw notFound("That witness is not one of yours.");
    });
    return { link: witnessLink(app.config.WEB_ORIGIN, token) };
  });

  app.delete("/deals/:id/witnesses/:witnessId", async (req) => {
    const userId = requireUser(req);
    const { id: dealId, witnessId } = parse(witnessParams, req.params);
    await asUser(app.db, userId, async (tx) => {
      const p = await party(tx, dealId, userId);
      atStage(p, "checks", "agreement");
      const [w] = await tx
        .select()
        .from(dealWitnesses)
        .where(and(eq(dealWitnesses.id, witnessId), eq(dealWitnesses.dealId, dealId), isNull(dealWitnesses.removedAt)));
      if (!w || w.side !== p.role) throw notFound("That witness is not one of yours.");
      if (w.signedHash && w.signedHash === p.deal.agreementHash)
        throw new HttpError(409, "This witness has signed the agreement; their signature stays on record.");
      await tx.update(dealWitnesses).set({ removedAt: sql`now()` }).where(eq(dealWitnesses.id, witnessId));
      await log(tx, p, "witness.removed", `${p.me.fullName} removed ${w.fullName} as a witness.`);
    });
    return { ok: true };
  });

  // --- Payment and handover ------------------------------------------------------------------

  app.post("/deals/:id/payments", async (req, reply) => {
    const userId = requireUser(req);
    const { id: dealId } = parse(dealParams, req.params);
    const body = parse(
      z.object({
        amountKobo: kobo,
        method: z.enum(["transfer", "cash", "cheque", "other"]),
        reference: z.string().trim().max(120).default(""),
        paidOn: z.iso.date(),
        note: z.string().trim().max(1000).default(""),
        proofFileId: id.nullable().default(null),
        signedName: z.string().trim().min(3).max(120),
      }),
      req.body,
    );
    const payment = await asUser(app.db, userId, async (tx) => {
      const p = await party(tx, dealId, userId);
      atStage(p, "payment");
      if (p.role !== "buyer") throw forbidden("The buyer records what they have paid.");
      if (p.deal.paidAt) throw new HttpError(409, "The full price has already been confirmed as paid.");
      if (!sameName(body.signedName, p.me.fullName))
        throw new HttpError(422, `Sign with your full name as on your account: ${p.me.fullName}.`);
      if (body.paidOn > today()) throw new HttpError(422, "The payment date cannot be in the future.");
      if (body.method === "transfer" && !body.proofFileId)
        throw new HttpError(422, "Attach the transfer receipt, so the seller can match it.");
      if (body.proofFileId) {
        const [f] = await tx
          .select({ id: files.id })
          .from(files)
          .where(and(eq(files.id, body.proofFileId), eq(files.dealId, dealId), eq(files.ready, true)));
        if (!f) throw new HttpError(422, "The receipt was not found on this deal. Upload it again.");
      }
      const [row] = await tx
        .insert(dealPayments)
        .values({ ...body, dealId, declaredBy: userId })
        .returning();
      await log(
        tx,
        p,
        "payment.declared",
        `${p.me.fullName} recorded a payment of ${formatKobo(body.amountKobo)} (${body.method}).`,
      );
      await enqueue(tx, { kind: "payment.declared", payload: { paymentId: row!.id } });
      return row!;
    });
    return reply.status(201).send({ payment: { id: payment.id } });
  });

  async function answerPayment(dealId: string, paymentId: string, userId: string, confirm: boolean, note: string) {
    await asUser(app.db, userId, async (tx) => {
      const p = await party(tx, dealId, userId);
      atStage(p, "payment");
      if (p.role !== "seller") throw forbidden("Only the seller can say whether a payment arrived.");
      const [pay] = await tx
        .select()
        .from(dealPayments)
        .where(and(eq(dealPayments.id, paymentId), eq(dealPayments.dealId, dealId)));
      if (!pay) throw notFound("Payment not found.");
      if (pay.status !== "submitted") throw new HttpError(409, "This payment has already been answered.");
      if (!confirm && !note) throw new HttpError(422, "Say what is wrong with this payment.");
      await tx
        .update(dealPayments)
        .set({ status: confirm ? "confirmed" : "disputed", responseNote: note, respondedAt: sql`now()` })
        .where(eq(dealPayments.id, paymentId));
      await log(
        tx,
        p,
        confirm ? "payment.confirmed" : "payment.disputed",
        confirm
          ? `${p.me.fullName} confirmed receiving ${formatKobo(pay.amountKobo)}.`
          : `${p.me.fullName} has not received the ${formatKobo(pay.amountKobo)} recorded: “${note}”.`,
      );
      if (confirm) {
        const { rows } = await tx.execute<{ total: number }>(
          sql`select coalesce(sum(amount_kobo), 0)::float8 as total from deal_payments where deal_id = ${dealId} and status = 'confirmed'`,
        );
        if (rows[0]!.total >= p.deal.agreedKobo!) {
          await tx.update(deals).set({ paidAt: sql`now()` }).where(eq(deals.id, dealId));
          await log(
            tx,
            p,
            "deal.paid",
            `The full price of ${formatKobo(p.deal.agreedKobo)} has been paid and confirmed. Next: handover.`,
          );
          await enqueue(tx, { kind: "deal.stage", payload: { dealId, stage: "paid" } });
        }
      }
      await enqueue(tx, { kind: "payment.answered", payload: { paymentId } });
    });
    return { ok: true };
  }

  app.post("/deals/:id/payments/:paymentId/confirm", async (req) => {
    const { id: dealId, paymentId } = parse(paymentParams, req.params);
    const { note } = parse(z.object({ note: z.string().trim().max(1000).default("") }), req.body ?? {});
    return answerPayment(dealId, paymentId, requireUser(req), true, note);
  });
  app.post("/deals/:id/payments/:paymentId/dispute", async (req) => {
    const { id: dealId, paymentId } = parse(paymentParams, req.params);
    const { note } = parse(z.object({ note: z.string().trim().max(1000).default("") }), req.body ?? {});
    return answerPayment(dealId, paymentId, requireUser(req), false, note);
  });

  /** Seller: handed over. Buyer: received. When both have said so, the land is sold. */
  app.post("/deals/:id/handover", async (req) => {
    const userId = requireUser(req);
    const { id: dealId } = parse(dealParams, req.params);
    await asUser(app.db, userId, async (tx) => {
      const p = await party(tx, dealId, userId);
      atStage(p, "payment");
      if (!p.deal.paidAt) throw new HttpError(409, "Handover comes after the full price is paid and confirmed.");
      if (p.role === "seller") {
        if (p.deal.sellerHandoverAt) throw new HttpError(409, "You have already confirmed the handover.");
        await tx.update(deals).set({ sellerHandoverAt: sql`now()` }).where(eq(deals.id, dealId));
        await log(
          tx,
          p,
          "handover.given",
          `${p.me.fullName} confirmed handing over the land and its original documents.`,
        );
        await enqueue(tx, { kind: "deal.stage", payload: { dealId, stage: "handover" } });
      } else {
        if (!p.deal.sellerHandoverAt) throw new HttpError(409, "The seller has not yet confirmed the handover.");
        await tx
          .update(deals)
          .set({ buyerReceivedAt: sql`now()`, completedAt: sql`now()`, stage: "completed" })
          .where(eq(deals.id, dealId));
        await log(
          tx,
          p,
          "deal.completed",
          `${p.me.fullName} confirmed receiving the land and documents. The sale is complete.`,
        );
        await tx.execute(sql`select app.sync_listing(${p.deal.listingId})`);
        await enqueue(tx, { kind: "deal.stage", payload: { dealId, stage: "completed" } });
      }
    });
    return { ok: true };
  });

  app.post("/deals/:id/cancel", async (req) => {
    const userId = requireUser(req);
    const { id: dealId } = parse(dealParams, req.params);
    const { reason } = parse(z.object({ reason: z.string().trim().min(3, "Give a reason.").max(1000) }), req.body);
    await asUser(app.db, userId, async (tx) => {
      const p = await party(tx, dealId, userId);
      atStage(p, "negotiating", "checks", "agreement", "payment");
      if (p.deal.paidAt)
        throw new HttpError(
          409,
          "The full price has been paid, so this deal cannot simply be cancelled. Contact us to resolve it.",
        );
      const { rows } = await tx.execute<{ n: number }>(
        sql`select count(*)::int as n from deal_payments where deal_id = ${dealId} and status = 'confirmed'`,
      );
      await tx
        .update(dealOffers)
        .set({ status: "withdrawn", respondedAt: sql`now()` })
        .where(and(eq(dealOffers.dealId, dealId), eq(dealOffers.status, "open")));
      await tx
        .update(deals)
        .set({ stage: "cancelled", cancelledAt: sql`now()`, cancelledBy: userId, cancelReason: reason })
        .where(eq(deals.id, dealId));
      await log(
        tx,
        p,
        "deal.cancelled",
        `${p.me.fullName} cancelled the deal: “${reason}”.${rows[0]!.n ? " Payments already confirmed must be refunded under clause 8 of the agreement." : ""}`,
      );
      await tx.execute(sql`select app.sync_listing(${p.deal.listingId})`);
      await enqueue(tx, { kind: "deal.cancelled", payload: { dealId } });
    });
    return { ok: true };
  });

  /** The agreement as a PDF: the text, every signature and witness, and the certificate. */
  app.get("/deals/:id/agreement.pdf", async (req, reply) => {
    const userId = requireUser(req);
    const { id: dealId } = parse(dealParams, req.params);
    const pdf = await asUser(app.db, userId, async (tx) => {
      const [d] = await tx.select().from(deals).where(eq(deals.id, dealId));
      if (!d) throw notFound("Deal not found.");
      if (!d.agreementText || !d.agreementHash) throw new HttpError(409, "The agreement has not been prepared yet.");
      const people = await tx
        .select({ id: users.id, fullName: users.fullName })
        .from(users)
        .where(sql`${users.id} in (${d.sellerId}, ${d.buyerId})`);
      const sigs = await tx.select().from(dealSignatures).where(eq(dealSignatures.dealId, dealId));
      const wits = await tx
        .select()
        .from(dealWitnesses)
        .where(and(eq(dealWitnesses.dealId, dealId), isNull(dealWitnesses.removedAt)));
      const pays = await tx
        .select()
        .from(dealPayments)
        .where(eq(dealPayments.dealId, dealId))
        .orderBy(asc(dealPayments.createdAt));
      const signers = (["seller", "buyer"] as const).flatMap((side) => {
        const person = people.find((x) => x.id === (side === "seller" ? d.sellerId : d.buyerId))!;
        const sig = sigs.find((s) => s.party === side && s.agreementHash === d.agreementHash);
        return [
          {
            role: side === "seller" ? "Vendor (seller)" : "Purchaser (buyer)",
            name: person.fullName,
            signedName: sig?.signedName ?? null,
            signedAt: sig?.signedAt ?? null,
            ip: sig?.ip,
          },
          ...wits
            .filter((w) => w.side === side)
            .map((w) => {
              const current = w.signedHash === d.agreementHash;
              return {
                role: `Witness to the ${side === "seller" ? "Vendor" : "Purchaser"}`,
                name: w.fullName,
                signedName: current ? w.signedName : null,
                signedAt: current ? w.signedAt : null,
                ip: current ? w.ip : undefined,
                extra: [w.occupation, w.address].filter(Boolean).join(", ") || undefined,
              };
            }),
        ];
      });
      return agreementPdf({
        dealId,
        text: d.agreementText,
        hash: d.agreementHash,
        signers,
        payments: pays.map((x) => ({
          amountKobo: x.amountKobo,
          paidOn: x.paidOn,
          method: x.method,
          reference: x.reference,
          status: x.status,
        })),
        completedAt: d.completedAt,
      });
    });
    return reply
      .header("content-type", "application/pdf")
      .header("content-disposition", `inline; filename="land-sale-agreement-${dealId.slice(0, 8)}.pdf"`)
      .header("cache-control", "private, no-store")
      .send(pdf);
  });
}
