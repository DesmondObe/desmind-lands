import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { AwsClient } from "aws4fetch";

/**
 * Where uploaded files live. Browsers upload and download directly, with short-lived signed
 * URLs, so file bytes never pass through the API. The API only decides who may have a URL.
 */
export interface Storage {
  readonly driver: "s3" | "local" | "onedrive";
  /** A URL the browser PUTs the file to. The type and exact size are part of the signature. */
  uploadUrl(
    key: string,
    contentType: string,
    sizeBytes: number,
  ): Promise<{ url: string; headers: Record<string, string> }>;
  /** A URL that serves the file for a few minutes, as an attachment or inline. */
  downloadUrl(key: string, filename: string, inline: boolean): Promise<string>;
  /** What is stored under a key, or null. */
  head(key: string): Promise<{ sizeBytes: number; contentType: string } | null>;
  delete(key: string): Promise<void>;
}

const UPLOAD_SECONDS = 15 * 60;
const DOWNLOAD_SECONDS = 10 * 60;

/** Content-Disposition with the filename safe for any header, in ASCII and in full. */
export function disposition(filename: string, inline: boolean) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

// --- S3 and anything that speaks its API (R2, Spaces, MinIO, Wasabi...) --------------------

export function s3Storage(opts: {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}): Storage {
  const client = new AwsClient({
    accessKeyId: opts.accessKeyId,
    secretAccessKey: opts.secretAccessKey,
    service: "s3",
    region: opts.region,
    retries: 2,
  });
  // Path-style URLs work with every S3-compatible service.
  const objectUrl = (key: string) =>
    `${opts.endpoint.replace(/\/$/, "")}/${opts.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;

  return {
    driver: "s3",
    async uploadUrl(key, contentType, sizeBytes) {
      const url = new URL(objectUrl(key));
      url.searchParams.set("X-Amz-Expires", String(UPLOAD_SECONDS));
      const headers = { "content-type": contentType, "content-length": String(sizeBytes) };
      const signed = await client.sign(url.toString(), {
        method: "PUT",
        headers,
        aws: { signQuery: true, allHeaders: true },
      });
      // Browsers set Content-Length themselves; they must send the type exactly as signed.
      return { url: signed.url, headers: { "content-type": contentType } };
    },
    async downloadUrl(key, filename, inline) {
      const url = new URL(objectUrl(key));
      url.searchParams.set("X-Amz-Expires", String(DOWNLOAD_SECONDS));
      url.searchParams.set("response-content-disposition", disposition(filename, inline));
      const signed = await client.sign(url.toString(), { method: "GET", aws: { signQuery: true } });
      return signed.url;
    },
    async head(key) {
      const res = await client.fetch(objectUrl(key), { method: "HEAD" });
      if (res.status === 404 || res.status === 403) return null;
      if (!res.ok) throw new Error(`Storage HEAD failed: ${res.status}`);
      return {
        sizeBytes: Number(res.headers.get("content-length") ?? 0),
        contentType: res.headers.get("content-type") ?? "",
      };
    },
    async delete(key) {
      const res = await client.fetch(objectUrl(key), { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error(`Storage DELETE failed: ${res.status}`);
    },
  };
}

/**
 * Lets browsers on `origins` PUT and GET objects in the bucket with the signed URLs above.
 * Browsers upload straight to the bucket, so without this every upload fails CORS.
 * Replaces the bucket's CORS rules; safe to run on every start.
 */
export async function putBucketCors(
  opts: { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string },
  origins: string[],
) {
  const client = new AwsClient({
    accessKeyId: opts.accessKeyId,
    secretAccessKey: opts.secretAccessKey,
    service: "s3",
    region: opts.region,
  });
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body =
    `<CORSConfiguration><CORSRule>` +
    origins.map((o) => `<AllowedOrigin>${esc(o)}</AllowedOrigin>`).join("") +
    `<AllowedMethod>GET</AllowedMethod><AllowedMethod>PUT</AllowedMethod><AllowedMethod>HEAD</AllowedMethod>` +
    `<AllowedHeader>*</AllowedHeader><ExposeHeader>ETag</ExposeHeader><MaxAgeSeconds>3600</MaxAgeSeconds>` +
    `</CORSRule></CORSConfiguration>`;
  const md5 = createHash("md5").update(body).digest("base64");
  const res = await client.fetch(`${opts.endpoint.replace(/\/$/, "")}/${opts.bucket}?cors`, {
    method: "PUT",
    headers: { "content-type": "application/xml", "content-md5": md5 },
    body,
  });
  if (!res.ok) throw new Error(`Storage CORS failed: ${res.status} ${await res.text()}`);
}

// --- Local disk, for development and tests --------------------------------------------------

/** Storage the API itself receives and serves files for, at /storage?grant=… (routes/files.ts). */
export type ProxiedStorage = Storage & {
  readGrant(token: string): LocalGrant | null;
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  read(key: string): Promise<Buffer | null>;
};

type LocalGrant = { k: string; op: "put" | "get"; exp: number; ct?: string; n?: number; fn?: string; inl?: boolean };

/**
 * Files on this machine's disk, served by the API itself at /storage?grant=…. A grant is a
 * signed, expiring note of what may be done to which key, standing in for S3's signed URLs.
 * Not for production: it ties files to one server.
 */
export function localStorage(opts: { dir: string; publicBase: string; secret?: string }) {
  const secret = opts.secret ?? randomBytes(32).toString("hex");
  const root = resolve(opts.dir);
  const pathOf = (key: string) => {
    const full = resolve(join(root, key));
    if (!full.startsWith(root + sep)) throw new Error("Bad storage key.");
    return full;
  };
  const sign = (body: string) => createHmac("sha256", secret).update(body).digest("base64url");
  const grant = (g: LocalGrant) => {
    const body = Buffer.from(JSON.stringify(g)).toString("base64url");
    return `${opts.publicBase.replace(/\/$/, "")}/storage?grant=${body}.${sign(body)}`;
  };

  const storage: ProxiedStorage = {
    driver: "local",
    async uploadUrl(key, contentType, sizeBytes) {
      const url = grant({ k: key, op: "put", exp: Date.now() + UPLOAD_SECONDS * 1000, ct: contentType, n: sizeBytes });
      return { url, headers: { "content-type": contentType } };
    },
    async downloadUrl(key, filename, inline) {
      return grant({ k: key, op: "get", exp: Date.now() + DOWNLOAD_SECONDS * 1000, fn: filename, inl: inline });
    },
    async head(key) {
      try {
        const [info, meta] = await Promise.all([stat(pathOf(key)), readFile(`${pathOf(key)}.type`, "utf8")]);
        return { sizeBytes: info.size, contentType: meta };
      } catch {
        return null;
      }
    },
    async delete(key) {
      await rm(pathOf(key), { force: true });
      await rm(`${pathOf(key)}.type`, { force: true });
    },
    readGrant(token) {
      const [body, sig] = token.split(".");
      if (!body || !sig) return null;
      const expected = Buffer.from(sign(body));
      const given = Buffer.from(sig);
      if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
      const g = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as LocalGrant;
      return g.exp > Date.now() ? g : null;
    },
    async put(key, bytes, contentType) {
      await mkdir(dirname(pathOf(key)), { recursive: true });
      await writeFile(pathOf(key), bytes);
      // The declared type is kept beside the file, as S3 keeps it with the object.
      await writeFile(`${pathOf(key)}.type`, contentType);
    },
    async read(key) {
      try {
        return await readFile(pathOf(key));
      } catch {
        return null;
      }
    },
  };
  return storage;
}

export type LocalStorage = ReturnType<typeof localStorage>;

// --- OneDrive, through Microsoft Graph -------------------------------------------------------

/** Where the newest refresh token is kept between restarts (the app_secrets table). */
export interface SecretStore {
  get(name: string): Promise<{ value: string; sourceHash: string } | null>;
  set(name: string, value: string, sourceHash: string): Promise<void>;
}

const GRAPH = "https://graph.microsoft.com/v1.0";
const ONEDRIVE_SCOPE = "Files.ReadWrite offline_access";

/**
 * Files in a folder of one person's OneDrive. Browsers send and fetch them through the API
 * (the same signed grants as local disk), and the API talks to Microsoft Graph, signing in
 * with a refresh token. Microsoft replaces that token at every use and the old one expires,
 * so the newest is kept, encrypted, in `secrets`; setting a new ONEDRIVE_REFRESH_TOKEN
 * replaces it.
 */
export function oneDriveStorage(opts: {
  clientId: string;
  clientSecret?: string;
  tenant?: string;
  refreshToken: string;
  tokenKey: string;
  folder: string;
  publicBase: string;
  secrets: SecretStore;
}): ProxiedStorage {
  // Only the signed grants come from here; no file is written to this folder.
  const grants = localStorage({ dir: join(tmpdir(), "lands-onedrive-unused"), publicBase: opts.publicBase });
  const folder = opts.folder.replace(/^\/+|\/+$/g, "");
  const key = createHash("sha256").update(opts.tokenKey).digest();
  const sourceHash = createHash("sha256").update(opts.refreshToken).digest("hex");

  const seal = (text: string) => {
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", key, iv);
    const body = Buffer.concat([c.update(text, "utf8"), c.final()]);
    return [iv, c.getAuthTag(), body].map((b) => b.toString("base64")).join(".");
  };
  const unseal = (sealed: string) => {
    const [iv, tag, body] = sealed.split(".").map((x) => Buffer.from(x, "base64"));
    const d = createDecipheriv("aes-256-gcm", key, iv!);
    d.setAuthTag(tag!);
    return Buffer.concat([d.update(body!), d.final()]).toString("utf8");
  };

  let cache: { token: string; expires: number } | null = null;
  let inflight: Promise<string> | null = null;

  async function signIn(): Promise<string> {
    const kept = await opts.secrets.get("onedrive_refresh");
    const refreshToken = kept && kept.sourceHash === sourceHash ? unseal(kept.value) : opts.refreshToken;
    const post = async (withSecret: boolean) => {
      const params: Record<string, string> = {
        client_id: opts.clientId,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: ONEDRIVE_SCOPE,
      };
      if (withSecret && opts.clientSecret) params.client_secret = opts.clientSecret;
      const res = await fetch(`https://login.microsoftonline.com/${opts.tenant || "consumers"}/oauth2/v2.0/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params),
        signal: AbortSignal.timeout(30_000),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, string | number | undefined>;
      return { res, json };
    };
    let out = await post(true);
    // A public client must not send a secret; some app registrations are one.
    if (
      !out.res.ok &&
      /90023|Public clients can't send a client secret/.test(String(out.json.error_description ?? ""))
    ) {
      out = await post(false);
    }
    if (!out.res.ok) {
      throw new Error(`OneDrive sign-in failed: ${out.json.error} ${out.json.error_description ?? ""}`);
    }
    if (out.json.refresh_token) {
      await opts.secrets.set("onedrive_refresh", seal(String(out.json.refresh_token)), sourceHash);
    }
    cache = { token: String(out.json.access_token), expires: Date.now() + Number(out.json.expires_in ?? 3600) * 1000 };
    return cache.token;
  }
  const accessToken = () => {
    if (cache && Date.now() < cache.expires - 60_000) return Promise.resolve(cache.token);
    inflight ??= signIn().finally(() => {
      inflight = null;
    });
    return inflight;
  };

  const itemUrl = (storageKey: string, suffix = "") =>
    `${GRAPH}/me/drive/root:/${`${folder}/${storageKey}`.split("/").map(encodeURIComponent).join("/")}${suffix}`;
  const graph = async (url: string, init: RequestInit = {}) =>
    fetch(url, {
      ...init,
      headers: { authorization: `Bearer ${await accessToken()}`, ...(init.headers as Record<string, string>) },
      signal: AbortSignal.timeout(120_000),
    });

  return {
    ...grants,
    driver: "onedrive",
    async head(storageKey) {
      const res = await graph(itemUrl(storageKey, "?$select=size,file"));
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`OneDrive HEAD failed: ${res.status}`);
      const item = (await res.json()) as { size?: number; file?: { mimeType?: string } };
      return { sizeBytes: item.size ?? 0, contentType: item.file?.mimeType ?? "application/octet-stream" };
    },
    async delete(storageKey) {
      const res = await graph(itemUrl(storageKey), { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error(`OneDrive DELETE failed: ${res.status}`);
    },
    // A plain upload: Graph takes up to 250 MB this way and makes the folders on the path.
    async put(storageKey, bytes, contentType) {
      const res = await graph(itemUrl(storageKey, ":/content"), {
        method: "PUT",
        headers: { "content-type": contentType || "application/octet-stream" },
        body: new Uint8Array(bytes),
      });
      if (!res.ok) throw new Error(`OneDrive upload failed: ${res.status} ${await res.text().catch(() => "")}`);
    },
    async read(storageKey) {
      const res = await graph(itemUrl(storageKey, ":/content"));
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`OneDrive read failed: ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    },
  };
}

export function storageFromEnv(
  env: {
    NODE_ENV: string;
    STORAGE_DRIVER?: string;
    STORAGE_DIR?: string;
    S3_ENDPOINT?: string;
    S3_REGION?: string;
    S3_BUCKET?: string;
    S3_ACCESS_KEY_ID?: string;
    S3_SECRET_ACCESS_KEY?: string;
    AZURE_CLIENT_ID?: string;
    AZURE_CLIENT_SECRET?: string;
    AZURE_TENANT_ID?: string;
    ONEDRIVE_REFRESH_TOKEN?: string;
    ONEDRIVE_TOKEN_KEY?: string;
    ONEDRIVE_FOLDER?: string;
    WEB_ORIGIN: string;
  },
  secrets?: SecretStore,
): Storage {
  if (env.STORAGE_DRIVER === "onedrive" || (!env.STORAGE_DRIVER && !env.S3_BUCKET && env.ONEDRIVE_REFRESH_TOKEN)) {
    const missing = ["AZURE_CLIENT_ID", "ONEDRIVE_REFRESH_TOKEN", "ONEDRIVE_TOKEN_KEY"].filter(
      (k) => !env[k as keyof typeof env],
    );
    if (missing.length) throw new Error(`OneDrive storage needs ${missing.join(", ")}.`);
    if (!secrets) throw new Error("OneDrive storage needs the database, to keep its refresh token.");
    return oneDriveStorage({
      clientId: env.AZURE_CLIENT_ID!,
      clientSecret: env.AZURE_CLIENT_SECRET,
      tenant: env.AZURE_TENANT_ID,
      refreshToken: env.ONEDRIVE_REFRESH_TOKEN!,
      tokenKey: env.ONEDRIVE_TOKEN_KEY!,
      folder: env.ONEDRIVE_FOLDER || "DesMindLands",
      publicBase: "/api",
      secrets,
    });
  }
  if (env.STORAGE_DRIVER === "s3" || (!env.STORAGE_DRIVER && env.S3_BUCKET)) {
    const missing = ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"].filter(
      (k) => !env[k as keyof typeof env],
    );
    if (missing.length) throw new Error(`S3 storage needs ${missing.join(", ")}.`);
    return s3Storage({
      endpoint: env.S3_ENDPOINT!,
      region: env.S3_REGION || "auto",
      bucket: env.S3_BUCKET!,
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    });
  }
  // Production needs real storage, unless a test deployment asks for disk by name
  // (STORAGE_DRIVER=local) and accepts that uploads vanish when the server restarts.
  if (env.NODE_ENV === "production" && env.STORAGE_DRIVER !== "local") {
    throw new Error("Set S3_* or the OneDrive settings for file storage. Local disk is for development only.");
  }
  // Through the web app's own /api, like every other API call, and relative to whatever address
  // the page was opened at: a link naming WEB_ORIGIN fails when that domain is not yet live.
  return localStorage({ dir: env.STORAGE_DIR || ".uploads", publicBase: "/api" });
}
