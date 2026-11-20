/**
 * One throwaway Postgres for the whole test run, migrated from scratch. Set
 * TEST_SYSTEM_DATABASE_URL (and TEST_DATABASE_URL) to use an existing server instead,
 * as CI does.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import type { TestProject } from "vitest/node";
import { ensureApiLogin, migrate } from "../src/db/migrate.ts";

declare module "vitest" {
  export interface ProvidedContext {
    systemUrl: string;
    apiUrl: string;
  }
}

export default async function setup(project: TestProject) {
  if (process.env.TEST_SYSTEM_DATABASE_URL && process.env.TEST_DATABASE_URL) {
    await migrate(process.env.TEST_SYSTEM_DATABASE_URL, () => {});
    project.provide("systemUrl", process.env.TEST_SYSTEM_DATABASE_URL);
    project.provide("apiUrl", process.env.TEST_DATABASE_URL);
    return;
  }

  const dir = await mkdtemp(join(tmpdir(), "lands-test-pg-"));
  const port = 5500 + Math.floor(Math.random() * 400);
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: "postgres",
    password: "postgres",
    port,
    persistent: false,
    // UTF-8 as in production, whatever the machine's own code page (Windows: WIN1252).
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("lands_test");

  const systemUrl = `postgres://postgres:postgres@localhost:${port}/lands_test`;
  await migrate(systemUrl, () => {});
  await ensureApiLogin(systemUrl, "lands_api", "lands_api");
  project.provide("systemUrl", systemUrl);
  project.provide("apiUrl", `postgres://lands_api:lands_api@localhost:${port}/lands_test`);

  return async () => {
    await pg.stop();
    await rm(dir, { recursive: true, force: true });
  };
}
