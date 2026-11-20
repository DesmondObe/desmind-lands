/**
 * Background worker: sends the emails queued in the outbox, and tidies up. Run as many
 * copies as the load needs; they share the work without coordination.
 */
import pg from "pg";
import { z } from "zod";
import { createMailer } from "./jobs/mailer.ts";
import { drainOnce, sweep } from "./jobs/outbox.ts";

const env = z
  .object({
    SYSTEM_DATABASE_URL: z.string().min(1),
    WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
    // Email: Resend (RESEND_API_KEY) or any SMTP server (SMTP_URL). Neither: printed to the log.
    RESEND_API_KEY: z.string().optional(),
    SMTP_URL: z.string().optional(),
    EMAIL_FROM: z.string().default("DesMind Lands <lands@desmindlabs.com>"),
  })
  .parse(Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== "")));

const db = new pg.Pool({ connectionString: env.SYSTEM_DATABASE_URL, max: 4 });
const mailer = createMailer({
  from: env.EMAIL_FROM,
  webOrigin: env.WEB_ORIGIN,
  resendApiKey: env.RESEND_API_KEY,
  smtpUrl: env.SMTP_URL,
});
console.log(
  `email: ${env.RESEND_API_KEY ? "Resend" : env.SMTP_URL ? "SMTP" : "printed to the log (no RESEND_API_KEY or SMTP_URL)"}, from ${env.EMAIL_FROM}`,
);

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    stopping = true;
  });
}

const idle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let lastSweep = 0;

console.log("worker started");
while (!stopping) {
  try {
    const handled = await drainOnce(db, mailer, env.WEB_ORIGIN);
    if (Date.now() - lastSweep > 3_600_000) {
      await sweep(db);
      lastSweep = Date.now();
    }
    if (handled === 0) await idle(2_000);
  } catch (err) {
    console.error("worker loop error:", (err as Error).message);
    await idle(5_000);
  }
}
await db.end();
console.log("worker stopped");
