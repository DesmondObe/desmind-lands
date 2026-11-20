import { sql } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { asUser, type Tx } from "../db/client.ts";
import { forbidden } from "../lib/errors.ts";
import { idParams, parse, requireUser } from "../lib/http.ts";
import { withCovers } from "./listings.ts";

async function requireAdmin(tx: Tx) {
  const { rows } = await tx.execute<{ a: boolean }>(sql`select app.is_admin() as a`);
  if (!rows[0]?.a) throw forbidden("This is for DesMind staff.");
}

/** DesMind staff: review listings before they go on the market, and keep an eye on deals. */
export async function adminRoutes(app: FastifyInstance) {
  const asAdmin = <T>(req: FastifyRequest, fn: (tx: Tx) => Promise<T>) =>
    asUser(app.db, requireUser(req), async (tx) => {
      await requireAdmin(tx);
      return fn(tx);
    });

  app.get("/admin/overview", async (req) =>
    asAdmin(req, async (tx) => {
      const { rows } = await tx.execute<Record<string, number>>(sql`
        select
          (select count(*)::int from listings where status = 'in_review') as "inReview",
          (select count(*)::int from listings where status in ('published', 'under_offer')) as "live",
          (select count(*)::int from listings where status = 'sold') as "sold",
          (select count(*)::int from deals where stage not in ('completed', 'cancelled')) as "openDeals",
          (select count(*)::int from deals where stage = 'completed') as "completedDeals",
          (select coalesce(sum(agreed_kobo), 0)::float8 from deals where stage = 'completed') as "completedValueKobo",
          (select count(*)::int from users) as "users",
          (select count(*)::int from deal_payments where status = 'disputed') as "disputedPayments"`);
      return rows[0];
    }),
  );

  app.get("/admin/listings", async (req) => {
    const { status } = parse(
      z.object({
        status: z
          .enum(["in_review", "published", "under_offer", "sold", "rejected", "withdrawn", "draft"])
          .default("in_review"),
      }),
      req.query,
    );
    return asAdmin(req, async (tx) => {
      const { rows } = await tx.execute<{ id: string }>(sql`
        select l.id, l.title, l.town, l.state, l.lga, l.price_kobo::float8 as "priceKobo", l.size_value::float as "sizeValue",
               l.size_unit as "sizeUnit", l.title_kind as "titleKind", l.status, l.review_note as "reviewNote",
               l.title_reference as "titleReference", l.title_searched_at as "titleSearchedAt",
               l.title_search_ref as "titleSearchRef", l.title_search_note as "titleSearchNote",
               l.updated_at as "updatedAt", u.full_name as "sellerName", u.email as "sellerEmail", u.phone as "sellerPhone",
               (select count(*)::int from files f where f.listing_id = l.id and f.kind <> 'photo' and f.ready) as "papers"
        from listings l join users u on u.id = l.seller_id
        where l.status = ${status}::listing_status
        order by l.updated_at ${status === "in_review" ? sql`asc` : sql`desc`}
        limit 200`);
      return { listings: await withCovers(tx, app.storage, rows) };
    });
  });

  /** Record the search of a listing's title at the State Ministry of Lands. Needed to publish. */
  app.post("/admin/listings/:id/title-search", async (req) => {
    const { id } = parse(idParams, req.params);
    const body = parse(
      z.object({
        reference: z.string().trim().min(2, "Give the Ministry of Lands search reference.").max(120),
        note: z.string().trim().max(1000).default(""),
      }),
      req.body,
    );
    return asAdmin(req, async (tx) => {
      const { rows } = await tx.execute<{ at: string }>(
        sql`select app.record_title_search(${id}, ${body.reference}, ${body.note}) as at`,
      );
      return { titleSearchedAt: rows[0]?.at };
    });
  });

  app.get("/admin/deals", async (req) =>
    asAdmin(req, async (tx) => {
      const { rows } = await tx.execute(sql`
        select d.id, d.stage, d.agreed_kobo::float8 as "agreedKobo", d.updated_at as "updatedAt", d.created_at as "createdAt",
               l.title, l.town, l.state, s.full_name as "sellerName", b.full_name as "buyerName",
               (select count(*)::int from deal_payments p where p.deal_id = d.id and p.status = 'disputed') as "disputed"
        from deals d join listings l on l.id = d.listing_id
        join users s on s.id = d.seller_id join users b on b.id = d.buyer_id
        order by d.updated_at desc limit 300`);
      return { deals: rows };
    }),
  );

  app.get("/admin/users", async (req) =>
    asAdmin(req, async (tx) => {
      const { rows } = await tx.execute(sql`
        select u.id, u.full_name as "fullName", u.email, u.phone, u.platform_role as "platformRole", u.created_at as "createdAt",
               (select count(*)::int from listings l where l.seller_id = u.id) as listings,
               (select count(*)::int from deals d where u.id in (d.seller_id, d.buyer_id)) as deals
        from users u order by u.created_at desc limit 500`);
      return { users: rows };
    }),
  );
}
