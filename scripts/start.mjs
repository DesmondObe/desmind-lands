/**
 * Starts the whole of DesMind Lands in one container, on Railway (railway.json). Its
 * settings are Railway variables: SYSTEM_DATABASE_URL, API_DB_PASSWORD, SITE_URL, the S3_*
 * storage keys, RESEND_API_KEY and EMAIL_FROM, and SEED_DEMO (0 in production).
 *
 *   1. migrations, as the database owner (SYSTEM_DATABASE_URL);
 *   2. the API's login role, `lands_api`, which row-level security applies to;
 *   3. the API on 127.0.0.1:4000, the background worker, and the web app on $PORT,
 *      which proxies /api to the API so the session cookie stays first-party;
 *   4. demo accounts, when SEED_DEMO=1.
 *
 * If any of the three processes stops, the container stops, and the host restarts it.
 * Production should run them as separate services instead (backend/Dockerfile).
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const backend = `${root}backend`;
const frontend = `${root}frontend`;

let system = process.env.SYSTEM_DATABASE_URL;
const apiPassword = process.env.API_DB_PASSWORD;
if (!system || !apiPassword) {
  console.error("Set SYSTEM_DATABASE_URL and API_DB_PASSWORD.");
  process.exit(1);
}
// Neon's pooled address ("ep-...-pooler.") runs PgBouncer in transaction mode, which loses
// session state between statements: the migration lock can be left held and every later
// start waits on it forever. Always use the direct address.
{
  const u = new URL(system);
  if (u.hostname.includes("-pooler.")) {
    u.hostname = u.hostname.replace("-pooler.", ".");
    system = u.toString();
    console.log("using Neon's direct address, not the pooler");
  }
}

// The API connects as lands_api, on the same server and database as the owner.
const apiUrl = new URL(system);
apiUrl.username = "lands_api";
apiUrl.password = apiPassword;

// The host's own address for the service, when WEB_ORIGIN / SITE_URL aren't set.
const hostUrl =
  process.env.RENDER_EXTERNAL_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "");

const env = {
  ...process.env,
  NODE_ENV: "production",
  // Links in emails and the API's own origin: the site's own domain once SITE_URL names it.
  WEB_ORIGIN: process.env.WEB_ORIGIN || process.env.SITE_URL || hostUrl || "http://localhost:3000",
  DATABASE_URL: process.env.DATABASE_URL || apiUrl.toString(),
  STORAGE_DRIVER:
    process.env.STORAGE_DRIVER ||
    (process.env.S3_BUCKET ? "s3" : process.env.ONEDRIVE_REFRESH_TOKEN ? "onedrive" : "local"),
};

const { migrate, ensureApiLogin, lockDemoAccounts } = await import(`${backend}/dist/db/migrate.js`);
await migrate(system);
await ensureApiLogin(system, "lands_api", apiPassword);
console.log("database ready");

// The demo accounts' password is in the source code, and one is staff. Unless demo
// data was asked for, nobody may sign in as them.
if (process.env.SEED_DEMO === "1") {
  console.warn(
    "WARNING: SEED_DEMO=1. The demo accounts (reviewer@demo.test is staff) have a public password. " +
      "Set SEED_DEMO=0 before real people use this site.",
  );
} else {
  const shut = await lockDemoAccounts(system);
  if (shut) console.log(`demo accounts shut: ${shut}`);
}

// Uploaded files go to the S3-compatible bucket (Neon Object Storage) when S3_BUCKET is set.
// Browsers upload to it directly, so it must accept requests from the site's own address.
if (process.env.S3_BUCKET) {
  const { putBucketCors } = await import(`${backend}/dist/lib/storage.js`);
  const origins = [env.WEB_ORIGIN, process.env.SITE_URL].filter(Boolean).map((o) => new URL(o).origin);
  try {
    await putBucketCors(
      {
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION || "auto",
        bucket: process.env.S3_BUCKET,
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
      [...new Set(origins)],
    );
    console.log(`file storage ready (bucket ${process.env.S3_BUCKET}, CORS for ${[...new Set(origins)].join(", ")})`);
  } catch (err) {
    // Not fatal: downloads still work; uploads from the browser will fail until fixed.
    console.error("could not set the bucket's CORS rules:", err.message);
  }
}

const children = [];
function run(name, command, args, cwd, extra = {}) {
  const child = spawn(command, args, { cwd, env: { ...env, ...extra }, stdio: "inherit" });
  child.on("exit", (code) => {
    console.error(`${name} stopped (${code ?? "signal"}); stopping the rest.`);
    for (const c of children) c.kill("SIGTERM");
    process.exit(code || 1);
  });
  children.push(child);
  return child;
}

run("api", process.execPath, ["dist/server.js"], backend, { PORT: "4000" });
run("worker", process.execPath, ["dist/worker.js"], backend);
run("web", process.execPath, [`${root}node_modules/next/dist/bin/next`, "start", "-p", process.env.PORT || "3000"], frontend, {
  API_URL: "http://127.0.0.1:4000",
  // The public address, for link previews, the sitemap and robots.txt (frontend/src/lib/site.ts).
  SITE_URL: process.env.SITE_URL || hostUrl,
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    for (const c of children) c.kill(signal);
    process.exit(0);
  });
}

if (process.env.SEED_DEMO === "1") {
  // Wait for the API, then create the demo accounts through it, as a person would.
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch("http://127.0.0.1:4000/health")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  // The seed script refuses NODE_ENV=production; this is an explicitly requested test deployment.
  const seed = spawn(process.execPath, ["scripts/seed-demo.ts"], {
    cwd: backend,
    env: { ...env, NODE_ENV: "staging", API_URL: "http://127.0.0.1:4000" },
    stdio: "inherit",
  });
  seed.on("exit", (code) => console.log(code === 0 ? "demo accounts ready" : `demo seed failed (${code})`));
}
