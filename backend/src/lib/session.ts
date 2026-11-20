import { sql } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Tx } from "../db/client.ts";
import { sessions } from "../db/schema.ts";
import { newSecret, sha256 } from "./tokens.ts";

export const SESSION_COOKIE = "lsid";

/** Switches the transaction's row-level-security identity, e.g. straight after sign-up. */
export async function actAs(tx: Tx, userId: string) {
  await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
}

export async function startSession(tx: Tx, req: FastifyRequest, reply: FastifyReply, userId: string) {
  const days = req.server.config.SESSION_DAYS;
  const token = newSecret();
  await actAs(tx, userId);
  await tx.insert(sessions).values({
    id: sha256(token),
    userId,
    expiresAt: new Date(Date.now() + days * 86_400_000),
    ip: req.ip,
    userAgent: (req.headers["user-agent"] ?? "").slice(0, 300),
  });
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.server.config.NODE_ENV === "production",
    path: "/",
    maxAge: days * 86_400,
  });
}
