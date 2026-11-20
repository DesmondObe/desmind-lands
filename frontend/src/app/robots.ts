import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/** The market and guides are for everyone; the rooms people deal in are private. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/dashboard", "/deals/", "/witness/", "/account", "/reset-password"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
