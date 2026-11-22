import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { asUser } from "../db/client.ts";
import { files, listings } from "../db/schema.ts";
import { forbidden, HttpError, notFound } from "../lib/errors.ts";
import { id, idParams, parse, queryFlag, requireUser } from "../lib/http.ts";
import { disposition, type ProxiedStorage } from "../lib/storage.ts";

const MB = 1024 * 1024;
const IMAGES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const PAPERS = [...IMAGES, "application/pdf"];

/** What each kind of file may be, and how large. */
const RULES: Record<string, { types: string[]; maxBytes: number; on: "listing" | "deal" | "both" }> = {
  photo: { types: IMAGES, maxBytes: 12 * MB, on: "listing" },
  title_document: { types: PAPERS, maxBytes: 20 * MB, on: "both" },
  survey_plan: { types: PAPERS, maxBytes: 20 * MB, on: "both" },
  payment_proof: { types: PAPERS, maxBytes: 10 * MB, on: "deal" },
  identity: { types: PAPERS, maxBytes: 10 * MB, on: "deal" },
  other: { types: PAPERS, maxBytes: 20 * MB, on: "both" },
};

const MAX_PHOTOS = 20;

/** A filename safe as the last part of a storage key. The original is kept for downloads. */
const keyName = (filename: string) =>
  filename
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^[._]+/, "")
    .slice(-80) || "file";

const uploadBody = z
  .object({
    listingId: id.optional(),
    dealId: id.optional(),
    kind: z.enum(["photo", "title_document", "survey_plan", "payment_proof", "identity", "other"]),
    filename: z.string().trim().min(1).max(200),
    contentType: z.string().trim().min(3).max(120),
    sizeBytes: z.number().int().positive(),
  })
  .refine((b) => !!b.listingId !== !!b.dealId, { message: "Say which listing or which deal the file is for." });

export async function fileRoutes(app: FastifyInstance) {
  const storage = app.storage;

  /** Step one: a signed URL the browser sends the file straight to. */
  app.post("/files/uploads", async (req, reply) => {
    const userId = requireUser(req);
    const body = parse(uploadBody, req.body);
    const rule = RULES[body.kind]!;
    if (rule.on === "listing" && !body.listingId) throw new HttpError(400, "Photos belong to a listing.");
    if (rule.on === "deal" && !body.dealId) throw new HttpError(400, "This kind of file belongs to a deal.");
    if (!rule.types.includes(body.contentType))
      throw new HttpError(
        415,
        body.kind === "photo" ? "Photos must be JPEG, PNG, WebP or HEIC." : "Upload a photo or a PDF.",
      );
    if (body.sizeBytes > rule.maxBytes) throw new HttpError(413, `That file is over ${rule.maxBytes / MB} MB.`);

    const file = await asUser(app.db, userId, async (tx) => {
      if (body.listingId) {
        const [l] = await tx
          .select({ sellerId: listings.sellerId, status: listings.status })
          .from(listings)
          .where(eq(listings.id, body.listingId));
        if (!l) throw notFound("Listing not found.");
        if (l.sellerId !== userId) throw forbidden("Only the seller adds files to a listing.");
        if (body.kind === "photo") {
          const { rows } = await tx.execute<{ n: number }>(
            sql`select count(*)::int as n from files where listing_id = ${body.listingId} and kind = 'photo'`,
          );
          if (rows[0]!.n >= MAX_PHOTOS) throw new HttpError(409, `A listing can have up to ${MAX_PHOTOS} photos.`);
        }
      }
      const { rows: pos } = body.listingId
        ? await tx.execute<{ p: number }>(
            sql`select coalesce(max(position) + 1, 0)::int as p from files where listing_id = ${body.listingId} and kind = ${body.kind}`,
          )
        : { rows: [{ p: 0 }] };
      const [row] = await tx
        .insert(files)
        .values({
          listingId: body.listingId ?? null,
          dealId: body.dealId ?? null,
          kind: body.kind,
          storageKey: `${body.listingId ? `listings/${body.listingId}` : `deals/${body.dealId}`}/${randomUUID()}/${keyName(body.filename)}`,
          filename: body.filename,
          contentType: body.contentType,
          sizeBytes: body.sizeBytes,
          position: pos[0]!.p,
          uploadedBy: userId,
        })
        .returning();
      return row!;
    });
    const upload = await storage.uploadUrl(file.storageKey, file.contentType, file.sizeBytes);
    return reply.status(201).send({ file: { id: file.id }, upload });
  });

  /** Step two: the browser says the file is up. Believed only once storage agrees. */
  app.post("/files/:id/complete", async (req) => {
    const userId = requireUser(req);
    const { id: fileId } = parse(idParams, req.params);
    return asUser(app.db, userId, async (tx) => {
      const [f] = await tx
        .select()
        .from(files)
        .where(and(eq(files.id, fileId), eq(files.uploadedBy, userId)));
      if (!f) throw notFound("File not found.");
      const stored = await storage.head(f.storageKey);
      if (!stored || stored.sizeBytes !== f.sizeBytes)
        throw new HttpError(409, "The file has not arrived in storage. Try uploading it again.");
      await tx.update(files).set({ ready: true }).where(eq(files.id, fileId));
      if (f.dealId) {
        await tx.execute(sql`
          insert into deal_events (deal_id, actor_id, actor_label, kind, summary)
          select ${f.dealId}, ${userId}, u.full_name, 'file.added', u.full_name || ' added a document: ' || ${f.filename}
          from users u where u.id = ${userId}`);
      }
      return { ok: true };
    });
  });

  /** A short-lived link to open or download a file the viewer may see. */
  app.get("/files/:id/url", async (req) => {
    const { id: fileId } = parse(idParams, req.params);
    const { download } = parse(z.object({ download: queryFlag }), req.query);
    return asUser(app.db, req.userId, async (tx) => {
      const [f] = await tx
        .select()
        .from(files)
        .where(and(eq(files.id, fileId), eq(files.ready, true)));
      if (!f) throw notFound("File not found, or you do not have access to it.");
      return { url: await storage.downloadUrl(f.storageKey, f.filename, !download) };
    });
  });

  app.delete("/files/:id", async (req) => {
    const userId = requireUser(req);
    const { id: fileId } = parse(idParams, req.params);
    await asUser(app.db, userId, async (tx) => {
      const [f] = await tx.select().from(files).where(eq(files.id, fileId));
      if (!f) throw notFound("File not found.");
      if (f.uploadedBy !== userId) throw forbidden("Only the person who added a file can remove it.");
      if (f.dealId) {
        const { rows } = await tx.execute<{ n: number }>(
          sql`select count(*)::int as n from deal_payments where proof_file_id = ${fileId}`,
        );
        if (rows[0]!.n) throw new HttpError(409, "This receipt is part of a recorded payment and stays on record.");
      }
      await tx.delete(files).where(eq(files.id, fileId));
      await storage.delete(f.storageKey).catch(() => {});
    });
    return { ok: true };
  });

  /** The seller's order of photos; the first is the cover. */
  app.post("/listings/:id/photo-order", async (req) => {
    const userId = requireUser(req);
    const { id: listingId } = parse(idParams, req.params);
    const { ids } = parse(z.object({ ids: z.array(id).min(1).max(MAX_PHOTOS) }), req.body);
    await asUser(app.db, userId, async (tx) => {
      for (const [i, fid] of ids.entries()) {
        await tx
          .update(files)
          .set({ position: i })
          .where(and(eq(files.id, fid), eq(files.listingId, listingId), eq(files.uploadedBy, userId)));
      }
    });
    return { ok: true };
  });

  // --- Files that pass through the API: local disk (development) and OneDrive ----------------

  if (storage.driver !== "s3") {
    const local = storage as ProxiedStorage;
    await app.register(async (scope) => {
      scope.addContentTypeParser("*", { parseAs: "buffer", bodyLimit: 26 * MB }, (_req, body, done) =>
        done(null, body),
      );
      const grantOf = (req: { query: unknown }) =>
        local.readGrant(String((req.query as { grant?: string }).grant ?? ""));
      scope.put("/storage", async (req) => {
        const g = grantOf(req);
        if (g?.op !== "put") throw new HttpError(403, "This upload link has expired.");
        const bytes = req.body as Buffer;
        if (req.headers["content-type"] !== g.ct || bytes.length !== g.n) {
          throw new HttpError(403, "The file does not match what the upload link was issued for.");
        }
        await local.put(g.k, bytes, g.ct!);
        return { ok: true };
      });
      scope.get("/storage", async (req, reply) => {
        const g = grantOf(req);
        if (g?.op !== "get") throw new HttpError(403, "This link has expired.");
        const [bytes, meta] = await Promise.all([local.read(g.k), local.head(g.k)]);
        if (!bytes || !meta) throw notFound();
        return reply
          .header("content-type", meta.contentType)
          .header("content-disposition", disposition(g.fn ?? "file", g.inl ?? false))
          .header("cache-control", "private, max-age=600")
          .header("cross-origin-resource-policy", "same-site")
          .send(bytes);
      });
    });
  }
}
