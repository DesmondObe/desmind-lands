/** How to reach DesMind Lands. */
export const contact = {
  email: "lands@desmindlabs.com",
  phone: "0703 642 7381",
  office: "492 Heliu Estate, Enugu South, Enugu State, Nigeria",
  company: "DesMind Labs Limited",
};

/** The site's public address, for link previews, the sitemap and robots.txt. */
export const siteUrl = (
  process.env.SITE_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "") ||
  "http://localhost:3000"
).replace(/\/$/, "");
