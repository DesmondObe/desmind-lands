import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { fromDatabaseError } from "../lib/errors.ts";
import * as schema from "./schema.ts";

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export function createDb(connectionString: string, max: number) {
  const pool = new pg.Pool({ connectionString, max, idleTimeoutMillis: 30_000 });
  return { pool, db: drizzle(pool, { schema }) };
}

/**
 * Runs `fn` in a transaction that row-level security sees as `userId` (or as an anonymous
 * visitor when null). Every database call the API makes goes through here.
 */
export async function asUser<T>(db: Db, userId: string | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.user_id', ${userId ?? ""}, true)`);
      return fn(tx);
    });
  } catch (err) {
    throw fromDatabaseError(err) ?? err;
  }
}
