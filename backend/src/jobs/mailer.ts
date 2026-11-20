import nodemailer from "nodemailer";
import { type EmailContacts, renderEmail } from "./email-template.ts";

export type Email = { to: string; subject: string; text: string };
export type Mailer = { send(email: Email): Promise<void> };

/** What the footer says when the contact details cannot be read. */
export const DEFAULT_CONTACTS: EmailContacts = {
  email: "lands@desmindlabs.com",
  phone: "0703 642 7381",
  office: "492 Heliu Estate, Enugu South, Enugu State, Nigeria",
  company: "DesMind Labs Limited",
  supportCompany: "DesMind Labs",
  supportEmail: "info@desmindlabs.com",
  supportPhone: "0703 642 7381",
  supportWebsite: "https://desmindlabs.com",
};

type Options = {
  from: string;
  webOrigin: string;
  /** Resend's API key (resend.com). Takes precedence over SMTP. */
  resendApiKey?: string;
  smtpUrl?: string;
  contacts?: () => Promise<EmailContacts>;
};

/**
 * Sends through Resend when RESEND_API_KEY is set, else SMTP when SMTP_URL is set; otherwise the
 * emails are printed, for local development. Every email goes out branded (email-template.ts),
 * with replies going to the site's contact email.
 */
export function createMailer(opts: Options): Mailer {
  const contacts = opts.contacts ?? (async () => DEFAULT_CONTACTS);
  const dress = async (email: Email) => {
    const c = await contacts();
    return { ...renderEmail(email, c, opts.webOrigin), replyTo: c.email };
  };

  if (opts.resendApiKey) {
    const key = opts.resendApiKey;
    return {
      async send(email) {
        const { html, text, replyTo } = await dress(email);
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
          body: JSON.stringify({
            from: opts.from,
            to: [email.to],
            subject: email.subject,
            html,
            text,
            reply_to: replyTo,
          }),
          signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) {
          // Resend says why (unverified domain, bad key); the outbox keeps it and retries.
          throw new Error(`Resend refused the email (${res.status}): ${(await res.text()).slice(0, 300)}`);
        }
      },
    };
  }

  if (opts.smtpUrl) {
    const transport = nodemailer.createTransport(opts.smtpUrl);
    return {
      async send(email) {
        const { html, text, replyTo } = await dress(email);
        await transport.sendMail({ from: opts.from, to: email.to, subject: email.subject, html, text, replyTo });
      },
    };
  }

  return {
    async send(email) {
      console.log(`\n--- email to ${email.to}: ${email.subject}\n${email.text}\n---`);
    },
  };
}
