import { eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { asUser } from "../db/client.ts";
import { sessions, users } from "../db/schema.ts";
import { HttpError } from "../lib/errors.ts";
import { parse, requireUser } from "../lib/http.ts";
import { LoginThrottle } from "../lib/login-throttle.ts";
import { enqueue } from "../lib/outbox.ts";
import { hashPassword, verifyPassword } from "../lib/passwords.ts";
import { optionalPhoneField } from "../lib/phone.ts";
import { actAs, SESSION_COOKIE, startSession } from "../lib/session.ts";
import { newSecret, sha256 } from "../lib/tokens.ts";

const email = z
  .email("Enter a valid email address.")
  .max(254)
  .transform((v) => v.trim().toLowerCase());
const password = z.string().min(10, "Use at least 10 characters.").max(200);
// The name on the agreement: what the person signs with, so it must be their full legal name.
const fullName = z
  .string()
  .trim()
  .min(3, "Enter your full name.")
  .max(120)
  .refine((v) => v.split(/\s+/).length >= 2, "Enter your full name as on your ID (first and last name).");

const registerBody = z.object({ email, password, fullName, phone: optionalPhoneField("Phone") });
const loginBody = z.object({ email, password: z.string().min(1).max(200) });
const profileBody = z.object({ fullName: fullName.optional(), phone: optionalPhoneField("Phone").optional() });
const changePasswordBody = z
  .object({ currentPassword: z.string().min(1).max(200), newPassword: password })
  .refine((b) => b.currentPassword !== b.newPassword, {
    path: ["newPassword"],
    message: "Choose a password different from the one you have now.",
  });

// Sign-in and sign-up are the endpoints worth guessing at; hold them to a tighter limit.
const authLimit = { rateLimit: { max: 10, timeWindow: "1 minute" } };

export async function authRoutes(app: FastifyInstance) {
  const throttle = new LoginThrottle();

  app.post("/auth/register", { config: authLimit }, async (req, reply) => {
    const body = parse(registerBody, req.body);
    const passwordHash = await hashPassword(body.password);
    await asUser(app.db, null, async (tx) => {
      const { rows } = await tx.execute<{ id: string }>(
        sql`select app.register_user(${body.email}, ${passwordHash}, ${body.fullName}, ${body.phone}) as id`,
      );
      const userId = rows[0]!.id;
      await startSession(tx, req, reply, userId);
      await enqueue(tx, { kind: "welcome", payload: { userId } });
    });
    return reply.status(201).send({ ok: true });
  });

  app.post("/auth/login", { config: authLimit }, async (req, reply) => {
    const body = parse(loginBody, req.body);
    const wait = throttle.lockedFor(body.email);
    if (wait > 0) {
      reply.header("retry-after", String(wait));
      throw new HttpError(
        429,
        `Too many wrong passwords for this account. Try again in ${Math.ceil(wait / 60)} minutes.`,
      );
    }
    return asUser(app.db, null, async (tx) => {
      const { rows } = await tx.execute<{ id: string; password_hash: string }>(
        sql`select id, password_hash from app.login_lookup(${body.email})`,
      );
      const found = rows[0];
      if (!(await verifyPassword(found?.password_hash, body.password)) || !found) {
        throttle.fail(body.email);
        throw new HttpError(401, "Email or password is incorrect.");
      }
      throttle.succeed(body.email);
      await startSession(tx, req, reply, found.id);
      return { ok: true };
    });
  });

  /** The same answer whether or not the address has an account. */
  app.post("/auth/forgot-password", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (req) => {
    const body = parse(z.object({ email }), req.body);
    const token = newSecret();
    await asUser(app.db, null, async (tx) => {
      const { rows } = await tx.execute<{ id: string | null }>(
        sql`select app.request_password_reset(${body.email}, ${sha256(token)}) as id`,
      );
      const userId = rows[0]?.id;
      if (userId) await enqueue(tx, { kind: "password.reset", payload: { userId, token } });
    });
    return { ok: true };
  });

  app.get("/auth/reset-password/:token", async (req) => {
    const { token } = parse(z.object({ token: z.string().min(20).max(100) }), req.params);
    return asUser(app.db, null, async (tx) => {
      const { rows } = await tx.execute<{ valid: boolean }>(
        sql`select app.password_reset_valid(${sha256(token)}) as valid`,
      );
      return { valid: !!rows[0]?.valid };
    });
  });

  app.post("/auth/reset-password", { config: authLimit }, async (req) => {
    const body = parse(z.object({ token: z.string().min(20).max(100), password }), req.body);
    const passwordHash = await hashPassword(body.password);
    await asUser(app.db, null, async (tx) => {
      const { rows } = await tx.execute<{ id: string }>(
        sql`select app.reset_password(${sha256(body.token)}, ${passwordHash}) as id`,
      );
      await actAs(tx, rows[0]!.id);
      const [me] = await tx.select({ email: users.email }).from(users).where(eq(users.id, rows[0]!.id));
      if (me) throttle.succeed(me.email);
    });
    return { ok: true };
  });

  app.post("/auth/logout", async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token && req.userId) {
      await asUser(app.db, req.userId, (tx) => tx.delete(sessions).where(eq(sessions.id, sha256(token))));
    }
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/me", async (req) => {
    const userId = requireUser(req);
    return asUser(app.db, userId, async (tx) => {
      const [user] = await tx
        .select({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          phone: users.phone,
          platformRole: users.platformRole,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, userId));
      // What is waiting on this person, for the badge in the menu.
      const { rows } = await tx.execute<{ n: number }>(sql`
        select count(*)::int as n from deals d
        where app.current_user_id() in (d.seller_id, d.buyer_id) and d.stage not in ('completed', 'cancelled')`);
      return { user, openDeals: rows[0]?.n ?? 0 };
    });
  });

  app.patch("/me", async (req) => {
    const userId = requireUser(req);
    const body = parse(profileBody, req.body);
    await asUser(app.db, userId, async (tx) => {
      // The name is what a person signs with. Once they have signed, it stays as signed.
      if (body.fullName) {
        const { rows } = await tx.execute<{ n: number }>(
          sql`select count(*)::int as n from deal_signatures where user_id = ${userId}`,
        );
        const [me] = await tx.select({ fullName: users.fullName }).from(users).where(eq(users.id, userId));
        if (rows[0]!.n > 0 && me && me.fullName !== body.fullName) {
          throw new HttpError(
            409,
            "You have signed an agreement with this name, so it cannot be changed here. Contact us.",
          );
        }
      }
      await tx
        .update(users)
        .set({
          ...(body.fullName ? { fullName: body.fullName } : {}),
          ...(body.phone !== undefined ? { phone: body.phone } : {}),
        })
        .where(eq(users.id, userId));
    });
    return { ok: true };
  });

  app.post("/me/password", { config: authLimit }, async (req) => {
    const userId = requireUser(req);
    const body = parse(changePasswordBody, req.body);
    const session = req.cookies[SESSION_COOKIE];
    const newHash = await hashPassword(body.newPassword);
    await asUser(app.db, userId, async (tx) => {
      const [me] = await tx.select({ email: users.email }).from(users).where(eq(users.id, userId));
      const { rows } = await tx.execute<{ password_hash: string }>(
        sql`select password_hash from app.login_lookup(${me!.email})`,
      );
      if (!(await verifyPassword(rows[0]?.password_hash, body.currentPassword))) {
        throw new HttpError(422, "Your current password is not right.");
      }
      await tx.update(users).set({ passwordHash: newHash }).where(eq(users.id, userId));
      // Every other device is signed out with the old password.
      await tx.execute(sql`delete from sessions where user_id = ${userId} and id <> ${session ? sha256(session) : ""}`);
    });
    return { ok: true };
  });
}
