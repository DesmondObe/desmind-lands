import { buildApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createDb } from "./db/client.ts";

const config = loadConfig();
const { pool, db } = createDb(config.DATABASE_URL, config.DB_POOL_MAX);
const app = await buildApp(config, db);

await app.listen({ port: config.PORT, host: "0.0.0.0" });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  });
}
