import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  SESSION_DAYS: z.coerce.number().int().positive().default(30),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  // File storage: any S3-compatible service. Unset: a folder on disk, outside production.
  STORAGE_DRIVER: z.enum(["s3", "local"]).optional(),
  STORAGE_DIR: z.string().optional(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  // `KEY=` in a .env file means "not set", not "set to nothing".
  const parsed = schema.safeParse(Object.fromEntries(Object.entries(env).filter(([, v]) => v !== "")));
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
