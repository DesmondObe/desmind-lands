/**
 * Every email DesMind Lands sends, in the site's own look: the wordmark on the green band, the
 * message, the main link as a button, and a footer with the contact details (DEFAULT_CONTACTS in
 * mailer.ts). A plain-text copy goes with each one, for mail apps that do not show HTML.
 *
 * The messages themselves are written as plain text (jobs/outbox.ts); this only dresses them.
 * Mail apps ignore stylesheets and web fonts, so the layout is tables with inline styles, and
 * the wordmark is text, not an image, so it shows even with images blocked.
 */

export type EmailContacts = {
  email: string;
  phone: string;
  office: string;
  company: string;
  supportCompany: string;
  supportEmail: string;
  supportPhone: string;
  supportWebsite: string;
};

const GREEN = "#163F33";
const GOLD = "#C9A55A";
const INK = "#1F2A26";
const SOFT = "#55615C";
const FAINT = "#8A948F";
const CANVAS = "#F4F1EA";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** What the button says, from where it leads. */
function buttonLabel(path: string): string {
  if (path.startsWith("/reset-password")) return "Choose a new password";
  if (path.startsWith("/witness")) return "Read and sign as witness";
  if (path.startsWith("/deals")) return "Open the deal room";
  if (path.startsWith("/sell") || path.startsWith("/dashboard")) return "Open my dashboard";
  if (path.startsWith("/admin")) return "Open the review queue";
  if (path.startsWith("/lands")) return "View the land";
  return "Open DesMind Lands";
}

const URL_RE = /https?:\/\/[^\s<>"]+[^\s<>".,;:)]/g;

/** One paragraph of the message as HTML: links stay links, line breaks stay. */
function paragraphHtml(p: string) {
  let out = "";
  let last = 0;
  for (const m of p.matchAll(URL_RE)) {
    out += escapeHtml(p.slice(last, m.index));
    const url = m[0];
    out += `<a href="${escapeHtml(url)}" style="color:${GREEN};text-decoration:underline;word-break:break-all">${escapeHtml(url)}</a>`;
    last = m.index! + url.length;
  }
  out += escapeHtml(p.slice(last));
  return out.replace(/\n/g, "<br>");
}

const telHref = (local: string) => `tel:+234${local.replace(/\D/g, "").replace(/^(234|0)/, "")}`;

function footerText(c: EmailContacts, webOrigin: string) {
  const lines = [
    "—",
    "DesMind Lands: land sold directly, owner to buyer. No agents.",
    [c.email, c.phone].filter(Boolean).join(" · "),
    c.office,
    webOrigin,
  ];
  const support = [c.supportCompany, c.supportEmail, c.supportPhone].filter(Boolean).join(", ");
  if (support) lines.push(`Technical support: ${support}`);
  return lines.filter(Boolean).join("\n");
}

/** The email as HTML and as plain text, both with the footer. */
export function renderEmail(
  email: { subject: string; text: string },
  contacts: EmailContacts,
  webOrigin: string,
): { html: string; text: string } {
  const origin = webOrigin.replace(/\/$/, "");
  const paragraphs = email.text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  // The first link into the site becomes the button; the paragraph keeps its words.
  let button: { url: string; label: string } | null = null;
  const body = paragraphs.map((p) => {
    if (!button) {
      const m = p.match(URL_RE)?.find((u) => u.startsWith(`${origin}/`) || u === origin);
      if (m) {
        button = { url: m, label: buttonLabel(m.slice(origin.length) || "/") };
        const words = p
          .replace(m, "")
          .replace(/[\s:]+$/, "")
          .trim();
        return words
          ? `<p style="margin:0 0 16px">${paragraphHtml(words.endsWith(".") ? words : `${words}:`)}</p>${buttonHtml(button)}`
          : buttonHtml(button);
      }
    }
    return `<p style="margin:0 0 16px">${paragraphHtml(p)}</p>`;
  });

  const c = contacts;
  const contactBits = [
    c.email &&
      `<a href="mailto:${escapeHtml(c.email)}" style="color:${GREEN};text-decoration:underline">${escapeHtml(c.email)}</a>`,
    c.phone && `<a href="${telHref(c.phone)}" style="color:${GREEN};text-decoration:none">${escapeHtml(c.phone)}</a>`,
  ].filter(Boolean);
  const supportBits = [
    c.supportCompany && escapeHtml(c.supportCompany),
    c.supportEmail &&
      `<a href="mailto:${escapeHtml(c.supportEmail)}" style="color:${SOFT};text-decoration:underline">${escapeHtml(c.supportEmail)}</a>`,
    c.supportPhone &&
      `<a href="${telHref(c.supportPhone)}" style="color:${SOFT};text-decoration:none">${escapeHtml(c.supportPhone)}</a>`,
  ].filter(Boolean);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(email.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${CANVAS};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(paragraphs[1] ?? paragraphs[0] ?? "")}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:${GREEN};padding:26px 32px">
<a href="${escapeHtml(origin)}" style="text-decoration:none">
<span style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#ffffff;letter-spacing:-0.3px">DesMind</span><br>
<span style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;letter-spacing:5px;color:${GOLD}">LANDS</span>
</a>
</td></tr>
<tr><td style="padding:32px 32px 8px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:${INK}">
<h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:24px;line-height:1.25;color:${INK}">${escapeHtml(email.subject)}</h1>
${body.join("\n")}
</td></tr>
<tr><td style="padding:8px 32px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #E4E0D6;padding-top:20px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:${SOFT}">
<strong style="color:${INK}">DesMind Lands</strong>, land sold directly, owner to buyer. No agents, no commission.<br>
${contactBits.join(" &nbsp;·&nbsp; ")}${c.office ? `<br>${escapeHtml(c.office)}` : ""}
${supportBits.length ? `<br><span style="color:${FAINT}">Technical support: ${supportBits.join(", ")}</span>` : ""}
</td></tr></table>
</td></tr>
</table>
<p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${FAINT}">${escapeHtml(c.company || "DesMind Labs Limited")} · <a href="${escapeHtml(origin)}" style="color:${FAINT}">${escapeHtml(origin.replace(/^https?:\/\//, ""))}</a></p>
</td></tr>
</table>
</body>
</html>`;

  return { html, text: `${email.text.trim()}\n\n${footerText(c, origin)}\n` };
}

function buttonHtml(b: { url: string; label: string }) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="background:${GREEN};border-radius:8px">
<a href="${escapeHtml(b.url)}" style="display:inline-block;padding:14px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none">${escapeHtml(b.label)}</a>
</td></tr></table>`;
}
