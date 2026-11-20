import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

const MIGRATIONS_DIR = fileURLToPath(new URL("../../migrations/", import.meta.url));

/**
 * Applies every migration in migrations/ that has not been applied yet, each in its own
 * transaction, in filename order. An advisory lock keeps two deploys from racing, and a
 * checksum refuses to continue if an applied migration has since been edited.
 *
 * Runs as the database owner (SYSTEM_DATABASE_URL), never as the API role.
 */
export async function migrate(connectionString: string, log: (msg: string) => void = console.log) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    // Give up loudly, rather than hang the deploy, if another session keeps the lock.
    await client.query("set lock_timeout = '90s'");
    try {
      await client.query("select pg_advisory_lock(hashtext('desmind-lands:migrate'))");
    } catch (err) {
      throw new Error(
        `Another session has held the migration lock for 90s (${(err as Error).message}). ` +
          "If no other deploy is running, a stale connection holds it: restart the database compute.",
      );
    }
    await client.query("reset lock_timeout");
    await client.query(`
      create table if not exists schema_migrations (
        name text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      )`);
    const { rows } = await client.query<{ name: string; checksum: string }>(
      "select name, checksum from schema_migrations",
    );
    const applied = new Map(rows.map((r) => [r.name, r.checksum]));

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      const sqlText = await readFile(MIGRATIONS_DIR + file, "utf8");
      const checksum = createHash("sha256").update(sqlText).digest("hex");
      const previous = applied.get(file);
      if (previous) {
        if (previous !== checksum) {
          throw new Error(`Migration ${file} was edited after it was applied. Add a new migration instead.`);
        }
        continue;
      }
      await client.query("begin");
      try {
        await client.query(sqlText);
        await client.query("insert into schema_migrations (name, checksum) values ($1, $2)", [file, checksum]);
        await client.query("commit");
        log(`applied ${file}`);
      } catch (err) {
        await client.query("rollback");
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
      }
    }
  } finally {
    await client.query("select pg_advisory_unlock(hashtext('desmind-lands:migrate'))").catch(() => {});
    await client.end();
  }
}

/**
 * Creates (or updates the password of) a login role for the API, as a member of lands_app.
 * For local development and tests; in production the role is created once by hand.
 */
export async function ensureApiLogin(connectionString: string, user: string, password: string) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const ident = client.escapeIdentifier(user);
    const literal = client.escapeLiteral(password);
    const { rowCount } = await client.query("select 1 from pg_roles where rolname = $1", [user]);
    await client.query(
      rowCount ? `alter role ${ident} login password ${literal}` : `create role ${ident} login password ${literal}`,
    );
    await client.query(`grant lands_app to ${ident}`);
  } finally {
    await client.end();
  }
}

/**
 * Shuts the demo accounts (anything@demo.test, made by scripts/seed-demo.ts) on a deployed
 * site: their password is in the source code, and one of them is staff. They keep their
 * data, so demo listings still show, but nobody can sign in as them. Runs as the database
 * owner. Returns how many accounts it shut.
 */
export async function lockDemoAccounts(connectionString: string) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query<{ id: string }>(
      `update users set password_hash = '!locked-demo-account', platform_role = null
       where email::text like '%@demo.test' and (password_hash <> '!locked-demo-account' or platform_role is not null)
       returning id`,
    );
    const ids = rows.map((r) => r.id);
    if (ids.length) await client.query("delete from sessions where user_id = any($1::uuid[])", [ids]);
    await client.query("commit");
    return ids.length;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}
