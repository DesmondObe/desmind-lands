import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { asUser } from "../db/client.ts";
import { notFound } from "../lib/errors.ts";
import { parse } from "../lib/http.ts";
import { sha256 } from "../lib/tokens.ts";

const tokenParams = z.object({ token: z.string().min(20).max(100) });

/**
 * A witness signs through the link they were sent; they need no account. The link's token is
 * the whole of their authority, so only its hash is kept, and it opens only this one deal.
 */
export async function witnessRoutes(app: FastifyInstance) {
  app.get("/witness/:token", async (req) => {
    const { token } = parse(tokenParams, req.params);
    return asUser(app.db, null, async (tx) => {
      const { rows } = await tx.execute<{ v: unknown }>(sql`select app.witness_view(${sha256(token)}) as v`);
      if (!rows[0]?.v) throw notFound("This witness link is not valid. Ask the person who sent it for a new one.");
      return rows[0].v;
    });
  });

  app.post("/witness/:token/sign", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req) => {
    const { token } = parse(tokenParams, req.params);
    const body = parse(
      z.object({
        signedName: z.string().trim().min(3).max(120),
        address: z.string().trim().min(5, "Give your address.").max(300),
        occupation: z.string().trim().min(2, "Give your occupation.").max(120),
        agreementHash: z.string().length(64),
        consent: z.literal(true, { error: "Tick the box to confirm you witnessed this signature." }),
      }),
      req.body,
    );
    await asUser(app.db, null, (tx) =>
      tx.execute(
        sql`select app.witness_sign(${sha256(token)}, ${body.signedName}, ${body.address}, ${body.occupation}, ${body.agreementHash}, ${req.ip}, ${String(req.headers["user-agent"] ?? "")})`,
      ),
    );
    return { ok: true };
  });
}
