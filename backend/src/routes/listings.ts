import { and, asc, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { asUser, type Tx } from "../db/client.ts";
import { files, listings, publicProfiles, savedListings, TITLE_KINDS } from "../db/schema.ts";
import { forbidden, HttpError, notFound } from "../lib/errors.ts";
import { idParams, parse, requireUser } from "../lib/http.ts";
import type { Storage } from "../lib/storage.ts";

export const FEATURES = [
  "fenced",
  "gated_estate",
  "dry_land",
  "road_access",
  "tarred_road",
  "electricity",
  "water",
  "corner_piece",
  "survey_done",
  "beacons_in_place",
  "no_family_claims",
  "near_express",
] as const;

const naira = z.coerce.number().int().positive().max(1e15);

const listingBody = z.object({
  title: z.string().trim().min(6, "Give the listing a title of at least 6 characters.").max(120),
  description: z.string().trim().max(5000).default(""),
  state: z.string().trim().min(2).max(60),
  lga: z.string().trim().max(80).default(""),
  town: z.string().trim().min(2, "Name the town or area.").max(80),
  addressLine: z.string().trim().max(200).default(""),
  sizeValue: z.coerce.number().positive("Size must be more than zero.").max(1e9),
  sizeUnit: z.enum(["plot", "sqm", "acre", "hectare"]),
  priceKobo: naira,
  negotiable: z.boolean().default(true),
  landUse: z.enum(["residential", "commercial", "agricultural", "industrial", "mixed"]),
  titleKind: z.enum(TITLE_KINDS),
  titleReference: z.string().trim().max(120).default(""),
  features: z.array(z.enum(FEATURES)).max(FEATURES.length).default([]),
  latitude: z.coerce.number().min(-90).max(90).nullable().default(null),
  longitude: z.coerce.number().min(-180).max(180).nullable().default(null),
});

const searchQuery = z.object({
  q: z.string().trim().max(100).optional(),
  state: z.string().trim().max(60).optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().positive().optional(),
  titleKind: z.enum(TITLE_KINDS).optional(),
  landUse: z.enum(["residential", "commercial", "agricultural", "industrial", "mixed"]).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc"]).default("newest"),
  includeSold: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().min(1).max(60).default(24),
  page: z.coerce.number().int().min(1).max(500).default(1),
});

// The columns a card shows. The street address is never on a card.
const cardColumns = sql`
  l.id, l.title, l.state, l.lga, l.town, l.size_value::float as "sizeValue", l.size_unit as "sizeUnit",
  l.price_kobo::float8 as "priceKobo", l.negotiable, l.land_use as "landUse", l.title_kind as "titleKind",
  l.features, l.status, l.published_at as "publishedAt", l.created_at as "createdAt"`;

type Card = {
  id: string;
  title: string;
  state: string;
  lga: string;
  town: string;
  sizeValue: number;
  sizeUnit: string;
  priceKobo: number;
  negotiable: boolean;
  landUse: string;
  titleKind: string;
  features: string[];
  status: string;
  publishedAt: string | null;
  createdAt: string;
};

/** The first photo of each listing, as a short-lived URL. */
export async function withCovers<T extends { id: string }>(tx: Tx, storage: Storage, rows: T[]) {
  if (!rows.length) return rows.map((r) => ({ ...r, coverUrl: null as string | null, photoCount: 0 }));
  const ids = rows.map((r) => r.id);
  const { rows: photos } = await tx.execute<{
    listing_id: string;
    storage_key: string;
    filename: string;
    n: number;
  }>(sql`
    select distinct on (listing_id) listing_id, storage_key, filename,
           count(*) over (partition by listing_id)::int as n
    from files
    where listing_id = any(${`{${ids.join(",")}}`}::uuid[])
      and kind = 'photo' and ready
    order by listing_id, position, created_at`);
  const byListing = new Map(photos.map((p) => [p.listing_id, p]));
  return Promise.all(
    rows.map(async (r) => {
      const p = byListing.get(r.id);
      return {
        ...r,
        coverUrl: p ? await storage.downloadUrl(p.storage_key, p.filename, true) : null,
        photoCount: p?.n ?? 0,
      };
    }),
  );
}

export async function listingRoutes(app: FastifyInstance) {
  /** The market: land for sale (and, if asked, land already sold through DesMind Lands). */
  app.get("/listings", async (req) => {
    const q = parse(searchQuery, req.query);
    return asUser(app.db, req.userId, async (tx) => {
      const where = [
        q.includeSold
          ? sql`l.status in ('published', 'under_offer', 'sold')`
          : sql`l.status in ('published', 'under_offer')`,
      ];
      if (q.q) {
        const like = `%${q.q.replace(/[%_\\]/g, "\\$&")}%`;
        where.push(
          sql`(l.search @@ plainto_tsquery('simple', ${q.q}) or l.title ilike ${like} or l.town ilike ${like} or l.lga ilike ${like})`,
        );
      }
      if (q.state) where.push(sql`l.state = ${q.state}`);
      if (q.minPrice) where.push(sql`l.price_kobo >= ${q.minPrice * 100}`);
      if (q.maxPrice) where.push(sql`l.price_kobo <= ${q.maxPrice * 100}`);
      if (q.titleKind) where.push(sql`l.title_kind = ${q.titleKind}`);
      if (q.landUse) where.push(sql`l.land_use = ${q.landUse}`);
      const order =
        q.sort === "price_asc"
          ? sql`l.price_kobo asc, l.id desc`
          : q.sort === "price_desc"
            ? sql`l.price_kobo desc, l.id desc`
            : sql`(l.status = 'sold'), coalesce(l.published_at, l.created_at) desc, l.id desc`;
      const { rows } = await tx.execute<Card & { total: number }>(sql`
        select ${cardColumns}, count(*) over ()::int as total
        from listings l
        where ${sql.join(where, sql` and `)}
        order by ${order}
        limit ${q.limit} offset ${(q.page - 1) * q.limit}`);
      const total = rows[0]?.total ?? 0;
      return {
        listings: await withCovers(
          tx,
          app.storage,
          rows.map(({ total: _t, ...r }) => r),
        ),
        total,
        page: q.page,
        pages: Math.max(1, Math.ceil(total / q.limit)),
      };
    });
  });

  /** Figures for the home page: land on the market, sold, and what sellers kept. */
  app.get("/stats", async (req) => {
    return asUser(app.db, req.userId, async (tx) => {
      const { rows } = await tx.execute<{ live: number; sold: number; sold_value: number; states: number }>(sql`
        select count(*) filter (where status in ('published', 'under_offer'))::int as live,
               count(*) filter (where status = 'sold')::int as sold,
               coalesce(sum(price_kobo) filter (where status = 'sold'), 0)::float8 as sold_value,
               count(distinct state) filter (where status in ('published', 'under_offer'))::int as states
        from listings`);
      const r = rows[0]!;
      return { live: r.live, sold: r.sold, soldValueKobo: r.sold_value, states: r.states };
    });
  });

  app.get("/listings/:id", async (req) => {
    const { id } = parse(idParams, req.params);
    return asUser(app.db, req.userId, async (tx) => {
      const [l] = await tx.select().from(listings).where(eq(listings.id, id));
      if (!l) throw notFound("This listing does not exist, or is not on the market.");
      const mine = l.sellerId === req.userId;
      const { rows: adminRows } = await tx.execute<{ a: boolean }>(sql`select app.is_admin() as a`);
      const admin = !!adminRows[0]?.a;
      const { rows: dealRows } = req.userId
        ? await tx.execute<{ id: string; stage: string }>(sql`
            select id, stage from deals where listing_id = ${id} and buyer_id = ${req.userId}
            order by (stage in ('completed', 'cancelled')), created_at desc limit 1`)
        : { rows: [] };
      const myDeal = dealRows[0] ?? null;
      const insider = mine || admin || (myDeal && myDeal.stage !== "cancelled");

      const [seller] = await tx.select().from(publicProfiles).where(eq(publicProfiles.id, l.sellerId));
      const { rows: sellerStats } = await tx.execute<{ listed: number; sold: number }>(sql`
        select count(*) filter (where status in ('published', 'under_offer', 'sold'))::int as listed,
               count(*) filter (where status = 'sold')::int as sold
        from listings where seller_id = ${l.sellerId}`);

      const photos = await tx
        .select({ id: files.id, storageKey: files.storageKey, filename: files.filename })
        .from(files)
        .where(and(eq(files.listingId, id), eq(files.kind, "photo"), eq(files.ready, true)))
        .orderBy(asc(files.position), asc(files.createdAt));
      // Papers: which kinds the seller has uploaded is public (it builds trust); the files
      // themselves are for the seller, staff and buyers with a deal (files_read policy).
      const { rows: paperKinds } = await tx.execute<{ kind: string; n: number }>(sql`
        select kind, count(*)::int as n from files
        where listing_id = ${id} and kind in ('title_document', 'survey_plan') and ready group by kind`);
      const papers = insider
        ? await tx
            .select({
              id: files.id,
              kind: files.kind,
              filename: files.filename,
              contentType: files.contentType,
              sizeBytes: files.sizeBytes,
            })
            .from(files)
            .where(and(eq(files.listingId, id), eq(files.ready, true), sql`${files.kind} <> 'photo'`))
            .orderBy(asc(files.createdAt))
        : [];
      const { rows: saved } = req.userId
        ? await tx.execute<{ s: boolean }>(
            sql`select exists (select 1 from saved_listings where user_id = ${req.userId} and listing_id = ${id}) as s`,
          )
        : { rows: [] };
      const { rows: interest } = await tx.execute<{ n: number }>(
        sql`select count(*)::int as n from deals where listing_id = ${id} and stage not in ('cancelled')`,
      );

      return {
        listing: {
          ...l,
          // The street address and title number are for people already dealing on the land.
          addressLine: insider ? l.addressLine : "",
          titleReference: insider ? l.titleReference : "",
          latitude: insider ? l.latitude : l.latitude == null ? null : Math.round(l.latitude * 100) / 100,
          longitude: insider ? l.longitude : l.longitude == null ? null : Math.round(l.longitude * 100) / 100,
          reviewNote: mine || admin ? l.reviewNote : "",
        },
        photos: await Promise.all(
          photos.map(async (p) => ({
            id: p.id,
            filename: p.filename,
            url: await app.storage.downloadUrl(p.storageKey, p.filename, true),
          })),
        ),
        paperKinds: Object.fromEntries(paperKinds.map((p) => [p.kind, p.n])),
        papers,
        seller: seller
          ? { id: seller.id, fullName: seller.fullName, since: seller.createdAt, ...sellerStats[0] }
          : null,
        viewer: { mine, admin, insider: !!insider, saved: !!saved[0]?.s },
        myDeal,
        interest: interest[0]?.n ?? 0,
      };
    });
  });

  /** The seller's own listings, with how many buyers are talking to them about each. */
  app.get("/me/listings", async (req) => {
    const userId = requireUser(req);
    return asUser(app.db, userId, async (tx) => {
      const { rows } = await tx.execute<Card & { reviewNote: string; openDeals: number }>(sql`
        select ${cardColumns}, l.review_note as "reviewNote",
               (select count(*)::int from deals d where d.listing_id = l.id and d.stage not in ('completed', 'cancelled')) as "openDeals"
        from listings l where l.seller_id = ${userId}
        order by l.updated_at desc`);
      return { listings: await withCovers(tx, app.storage, rows) };
    });
  });

  app.post("/listings", async (req, reply) => {
    const userId = requireUser(req);
    const body = parse(listingBody, req.body);
    const listing = await asUser(app.db, userId, async (tx) => {
      const [row] = await tx
        .insert(listings)
        .values({ ...body, sellerId: userId, status: "draft" })
        .returning({ id: listings.id });
      return row!;
    });
    return reply.status(201).send({ listing });
  });

  app.patch("/listings/:id", async (req) => {
    const userId = requireUser(req);
    const { id } = parse(idParams, req.params);
    const parsed = parse(listingBody.partial(), req.body);
    // Only what was sent: a field left out keeps its value (defaults are for new listings).
    const sent = new Set(Object.keys((req.body as object | null) ?? {}));
    const body = Object.fromEntries(Object.entries(parsed).filter(([k]) => sent.has(k))) as typeof parsed;
    await asUser(app.db, userId, async (tx) => {
      const [l] = await tx.select().from(listings).where(eq(listings.id, id));
      if (!l) throw notFound("Listing not found.");
      if (l.sellerId !== userId) throw forbidden("Only the seller can edit this listing.");
      if (l.status === "sold") throw new HttpError(409, "This land has been sold; its listing is kept as it was.");
      // On the market, what the land *is* (where, how big, which title) was checked by our
      // staff, so changing it means withdrawing and sending it for review again.
      if (["published", "under_offer"].includes(l.status)) {
        const core = ["state", "lga", "town", "sizeValue", "sizeUnit", "titleKind", "landUse"] as const;
        const changed = core.filter((k) => body[k] !== undefined && String(body[k]) !== String(l[k]));
        if (changed.length)
          throw new HttpError(
            409,
            "The location, size, use and title of land on the market were checked when it was reviewed. Withdraw the listing to change them, then send it for review again.",
          );
      }
      await tx.update(listings).set(body).where(eq(listings.id, id));
    });
    return { ok: true };
  });

  /** Seller: send for review, take back to draft, withdraw. Staff: publish or turn down. */
  app.post("/listings/:id/status", async (req) => {
    const userId = requireUser(req);
    const { id } = parse(idParams, req.params);
    const body = parse(
      z.object({
        status: z.enum(["in_review", "draft", "withdrawn", "published", "rejected"]),
        note: z.string().trim().max(1000).default(""),
      }),
      req.body,
    );
    await asUser(app.db, userId, async (tx) => {
      await tx.execute(sql`select app.set_listing_status(${id}, ${body.status}::listing_status, ${body.note})`);
      if (body.status === "published" || body.status === "rejected") {
        await tx.execute(
          sql`insert into outbox (kind, payload) values ('listing.reviewed', ${JSON.stringify({ listingId: id })}::jsonb)`,
        );
      }
    });
    return { ok: true };
  });

  app.delete("/listings/:id", async (req) => {
    const userId = requireUser(req);
    const { id } = parse(idParams, req.params);
    await asUser(app.db, userId, async (tx) => {
      const keys = await tx.select({ key: files.storageKey }).from(files).where(eq(files.listingId, id));
      const gone = await tx.delete(listings).where(eq(listings.id, id)).returning({ id: listings.id });
      if (!gone.length)
        throw new HttpError(
          409,
          "Only a draft, withdrawn or turned-down listing that nobody has made an offer on can be deleted.",
        );
      await Promise.all(keys.map((k) => app.storage.delete(k.key).catch(() => {})));
    });
    return { ok: true };
  });

  app.post("/listings/:id/save", async (req) => {
    const userId = requireUser(req);
    const { id } = parse(idParams, req.params);
    await asUser(app.db, userId, (tx) =>
      tx.insert(savedListings).values({ userId, listingId: id }).onConflictDoNothing(),
    );
    return { ok: true };
  });

  app.delete("/listings/:id/save", async (req) => {
    const userId = requireUser(req);
    const { id } = parse(idParams, req.params);
    await asUser(app.db, userId, (tx) =>
      tx.delete(savedListings).where(and(eq(savedListings.userId, userId), eq(savedListings.listingId, id))),
    );
    return { ok: true };
  });

  app.get("/me/saved", async (req) => {
    const userId = requireUser(req);
    return asUser(app.db, userId, async (tx) => {
      const { rows } = await tx.execute<Card>(sql`
        select ${cardColumns} from saved_listings s join listings l on l.id = s.listing_id
        where s.user_id = ${userId} order by s.created_at desc`);
      return { listings: await withCovers(tx, app.storage, rows) };
    });
  });
}
