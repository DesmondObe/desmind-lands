/**
 * Makes an existing account DesMind staff, who review listings:
 *   npm run admin:grant --workspace @lands/backend -- someone@example.com
 * Runs as the database owner (SYSTEM_DATABASE_URL).
 */
import pg from "pg";

const email = process.argv[2];
const url = process.env.SYSTEM_DATABASE_URL;
if (!email || !url) {
  console.error("Usage: SYSTEM_DATABASE_URL=... npm run admin:grant -- <email>");
  process.exit(1);
}
const client = new pg.Client({ connectionString: url });
await client.connect();
const { rowCount } = await client.query("update users set platform_role = 'admin' where email = $1", [email]);
await client.end();
console.log(rowCount ? `${email} is now an admin.` : `No account with the email ${email}. Sign up first.`);
process.exit(rowCount ? 0 : 1);
