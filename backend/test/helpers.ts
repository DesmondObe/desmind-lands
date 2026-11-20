import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import pg from "pg";
import { inject } from "vitest";
import { buildApp } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";
import { createDb } from "../src/db/client.ts";
import { localStorage } from "../src/lib/storage.ts";

export async function startApp() {
  const config = loadConfig({ NODE_ENV: "test", DATABASE_URL: inject("apiUrl"), WEB_ORIGIN: "http://localhost:3000" });
  const { pool, db } = createDb(config.DATABASE_URL, 5);
  const storage = localStorage({
    dir: mkdtempSync(join(tmpdir(), "lands-test-files-")),
    publicBase: "http://localhost:3000/api",
  });
  const app = await buildApp(config, db, { logger: false, storage });
  return { app, pool, storage };
}

type Res = { status: number; body: any };

/** A browser: remembers its session cookie between requests. */
export class Agent {
  cookie = "";
  readonly app: FastifyInstance;
  readonly ip = `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  userId = "";
  fullName = "";

  constructor(app: FastifyInstance) {
    this.app = app;
  }

  async request(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: unknown): Promise<Res> {
    const res = await this.app.inject({
      method,
      url,
      payload: payload as object | undefined,
      headers: this.cookie ? { cookie: this.cookie } : {},
      remoteAddress: this.ip,
    });
    const set = res.cookies.find((c) => c.name === "lsid");
    if (set) this.cookie = set.value ? `lsid=${set.value}` : "";
    const ct = String(res.headers["content-type"] ?? "");
    return { status: res.statusCode, body: ct.includes("json") && res.body ? res.json() : res.rawPayload };
  }

  get = (url: string) => this.request("GET", url);
  post = (url: string, body: unknown = {}) => this.request("POST", url, body);
  patch = (url: string, body: unknown) => this.request("PATCH", url, body);
  delete = (url: string) => this.request("DELETE", url);
}

let systemPool: pg.Pool | undefined;
export const system = () =>
  (systemPool ??= new pg.Pool({ connectionString: inject("systemUrl"), max: 2, allowExitOnIdle: true }));

/** A new account, signed in. */
export async function signUp(app: FastifyInstance, fullName = "Ada Okafor") {
  const a = new Agent(app);
  const res = await a.post("/auth/register", {
    email: `${randomUUID()}@test.example`,
    password: "correct horse battery",
    fullName,
  });
  if (res.status !== 201) throw new Error(`sign-up failed: ${JSON.stringify(res.body)}`);
  const me = await a.get("/me");
  a.userId = me.body.user.id;
  a.fullName = fullName;
  return a;
}

export async function makeAdmin(a: Agent) {
  await system().query("update users set platform_role = 'admin' where id = $1", [a.userId]);
}

/** Uploads a small file through the signed URL, as a browser would. */
export async function upload(
  a: Agent,
  target: { listingId?: string; dealId?: string },
  kind: string,
  type = "image/png",
) {
  const bytes = Buffer.from("not really a picture, but bytes all the same");
  const created = await a.post("/files/uploads", {
    ...target,
    kind,
    filename: kind === "photo" ? "land.png" : "paper.pdf",
    contentType: type,
    sizeBytes: bytes.length,
  });
  if (created.status !== 201) throw new Error(`upload refused: ${JSON.stringify(created.body)}`);
  const url = new URL(created.body.upload.url);
  const put = await a.app.inject({
    method: "PUT",
    url: `${url.pathname.replace(/^\/api/, "")}${url.search}`,
    payload: bytes,
    headers: { "content-type": type },
  });
  if (put.statusCode !== 200) throw new Error(`put failed: ${put.body}`);
  const done = await a.post(`/files/${created.body.file.id}/complete`);
  if (done.status !== 200) throw new Error(`complete failed: ${JSON.stringify(done.body)}`);
  return created.body.file.id as string;
}

export const LAND = {
  title: "Two dry plots at Emene, off the airport road",
  description: "Dry, fenced land with beacons in place.",
  state: "Enugu",
  lga: "Enugu East",
  town: "Emene",
  addressLine: "Plot 14, Umuchigbo layout",
  sizeValue: 2,
  sizeUnit: "plot",
  priceKobo: 1_500_000_000,
  negotiable: true,
  landUse: "residential",
  titleKind: "c_of_o",
  titleReference: "EN/1234/2019",
  features: ["fenced", "dry_land"],
};
