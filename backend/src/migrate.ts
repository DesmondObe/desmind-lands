import { migrate } from "./db/migrate.ts";

const url = process.env.SYSTEM_DATABASE_URL;
if (!url) {
  console.error("SYSTEM_DATABASE_URL is not set (the database owner connection used for migrations).");
  process.exit(1);
}
await migrate(url);
console.log("migrations up to date");
