import { randomBytes } from "node:crypto";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { sql } from "drizzle-orm";
import Fastify, { type FastifyInstance } from "fastify";
import type { Config } from "./config.ts";
import { asUser, type Db } from "./db/client.ts";
import { fromDatabaseError, HttpError } from "./lib/errors.ts";
import { SESSION_COOKIE } from "./lib/session.ts";
import { type Storage, storageFromEnv } from "./lib/storage.ts";
import { sha256 } from "./lib/tokens.ts";
import { adminRoutes } from "./routes/admin.ts";
import { authRoutes } from "./routes/auth.ts";
import { dealRoutes } from "./routes/deals.ts";
import { fileRoutes } from "./routes/files.ts";
import { listingRoutes } from "./routes/listings.ts";
import { witnessRoutes } from "./routes/witness.ts";

declare module "fastify" {
  interface FastifyInstance {
    db: Db;
    config: Config;
    storage: Storage;
  }
  interface FastifyRequest {
    userId: string | null;
  }
}

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function buildApp(
  config: Config,
  db: Db,
  opts: { logger?: boolean; storage?: Storage } = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? config.NODE_ENV !== "test",
    // Behind a load balancer: take the client address from X-Forwarded-For.
    trustProxy: true,
    bodyLimit: 1_000_000,
    // A short reference for every request, carried to the screen with any error.
    genReqId: () => randomBytes(4).toString("hex").toUpperCase(),
  });

  app.addHook("onSend", async (req, reply) => {
    reply.header("x-request-id", req.id);
  });

  app.decorate("db", db);
  app.decorate("config", config);
  // The one secret the app keeps for itself: OneDrive's newest refresh token (app_secrets).
  const secrets = {
    async get(name: string) {
      const { rows } = await db.execute<{ value: string; source_hash: string }>(
        sql`select value, source_hash from app_secrets where name = ${name}`,
      );
      return rows[0] ? { value: rows[0].value, sourceHash: rows[0].source_hash } : null;
    },
    async set(name: string, value: string, sourceHash: string) {
      await db.execute(sql`
        insert into app_secrets (name, value, source_hash) values (${name}, ${value}, ${sourceHash})
        on conflict (name) do update
          set value = excluded.value, source_hash = excluded.source_hash, updated_at = now()`);
    },
  };
  app.decorate("storage", opts.storage ?? storageFromEnv(config, secrets));
  app.decorateRequest("userId", null);

  await app.register(helmet);
  await app.register(cors, { origin: config.WEB_ORIGIN, credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, { global: true, max: 300, timeWindow: "1 minute" });

  // A browser's cross-site write is refused: a write must come from WEB_ORIGIN, or from the
  // very address the page was served from (the web app proxies /api and says so).
  app.addHook("onRequest", async (req) => {
    const origin = req.headers.origin;
    if (!UNSAFE.has(req.method) || !origin || origin === config.WEB_ORIGIN) return;
    const servedFrom = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "")
      .split(",")[0]!
      .trim()
      .toLowerCase();
    let originHost = "";
    try {
      originHost = new URL(origin).host.toLowerCase();
    } catch {}
    if (!servedFrom || originHost !== servedFrom) {
      throw new HttpError(403, "Cross-site request refused.");
    }
  });

  app.addHook("preHandler", async (req) => {
    const token = req.cookies[SESSION_COOKIE];
    if (!token) return;
    const hash = sha256(token);
    req.userId = await asUser(db, null, async (tx) => {
      const { rows } = await tx.execute<{ user_id: string | null }>(sql`select app.session_user(${hash}) as user_id`);
      return rows[0]?.user_id ?? null;
    });
  });

  // Every refusal says why; every failure is logged with the request's reference.
  app.setErrorHandler((err, req, reply) => {
    const known = err instanceof HttpError ? err : fromDatabaseError(err);
    const status = known?.status ?? (err as { statusCode?: number }).statusCode;
    if (known || (status && status < 500)) {
      const message = known?.message || (err as Error).message || "That request was refused.";
      req.log.info(
        { status, method: req.method, url: req.url, userId: req.userId, reason: message },
        "request refused",
      );
      return reply.status(status!).send({ error: message, ref: req.id });
    }
    req.log.error({ err, method: req.method, url: req.url, userId: req.userId }, "request failed");
    return reply.status(500).send({
      error: "Something went wrong on our side. It has been logged; quote the reference if you contact us.",
      ref: req.id,
    });
  });

  app.setNotFoundHandler((req, reply) =>
    reply.status(404).send({ error: `There is no ${req.method} ${req.url.split("?")[0]} on the server.`, ref: req.id }),
  );

  app.get("/health", async () => ({ ok: true }));
  app.get("/ready", async () => {
    await db.execute(sql`select 1`);
    return { ok: true };
  });

  await app.register(authRoutes);
  await app.register(listingRoutes);
  await app.register(fileRoutes);
  await app.register(dealRoutes);
  await app.register(witnessRoutes);
  await app.register(adminRoutes);
  return app;
}
