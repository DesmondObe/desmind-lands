/**
 * Runs a real Postgres for local development without Docker. Data persists in
 * backend/.pgdata. Leave it running in its own terminal.
 */
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import { ensureApiLogin, migrate } from "../src/db/migrate.ts";

const PORT = Number(process.env.LOCAL_PG_PORT ?? 5433);
const dataDir = fileURLToPath(new URL("../.pgdata", import.meta.url));

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: PORT,
  persistent: true,
  // UTF-8 as in production, whatever the machine's own code page (Windows: WIN1252).
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
});

try {
  await pg.initialise();
} catch {
  // Already initialised on an earlier run.
}
await pg.start();
try {
  await pg.createDatabase("lands");
} catch {
  // Already exists.
}

const system = `postgres://postgres:postgres@localhost:${PORT}/lands`;

// A data folder made before the UTF-8 flags above keeps the machine's code page, and the
// migrations (which contain characters such as "→") fail on it. Say so plainly.
{
  const client = pg.getPgClient("lands");
  await client.connect();
  const { rows } = await client.query<{ enc: string }>(
    "select pg_encoding_to_char(encoding) as enc from pg_database where datname = 'lands'",
  );
  await client.end();
  if (rows[0]?.enc !== "UTF8") {
    console.error(
      `\nThe local database is ${rows[0]?.enc}, not UTF8: it was created by an older version of this script.\n` +
        `Stop this script, delete the folder backend/.pgdata (your local test data), and run it again.\n`,
    );
    await pg.stop();
    process.exit(1);
  }
}

await migrate(system);
await ensureApiLogin(system, "lands_api", "lands_api");

console.log(`
Postgres is running on port ${PORT}. Put these in backend/.env:

  SYSTEM_DATABASE_URL=${system}
  DATABASE_URL=postgres://lands_api:lands_api@localhost:${PORT}/lands

Ctrl+C to stop.`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
