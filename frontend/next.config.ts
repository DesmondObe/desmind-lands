import type { NextConfig } from "next";

const API_URL = process.env.API_URL ?? "http://localhost:4000";
const production = process.env.NODE_ENV === "production";

/**
 * Where the browser uploads files: straight to the S3-compatible bucket through a signed URL
 * (backend/src/lib/storage.ts), so the page must be allowed to send there. Without
 * S3_ENDPOINT at build time, any HTTPS address is allowed rather than breaking uploads.
 */
function storageOrigin() {
  try {
    return process.env.S3_ENDPOINT ? new URL(process.env.S3_ENDPOINT).origin : "https:";
  } catch {
    return "https:";
  }
}

/**
 * What a page may load and do. Scripts and styles come only from this site (Next.js inlines
 * a few, and the theme script must run before paint, hence 'unsafe-inline'); nothing may
 * frame the site (clickjacking); plugins, <base> tricks and forms posting elsewhere are off.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  // Listing photos come from storage through signed HTTPS links.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${storageOrigin()}`,
  "media-src 'self' blob:",
  // The map of the land, on a listing and in the deal room.
  "frame-src https://www.google.com https://maps.google.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(production ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // The camera takes photos of land and receipts; location fills in where the land is.
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(self), payment=(), usb=(), interest-cohort=()",
  },
  ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
];

const config: NextConfig = {
  poweredByHeader: false,
  // The API is served under the web origin, so its session cookie is first-party.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/:path*` }];
  },
  // The API sets its own headers (helmet) on /api.
  async headers() {
    return [{ source: "/((?!api/).*)", headers: securityHeaders }];
  },
};

export default config;
