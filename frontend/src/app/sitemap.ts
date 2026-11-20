import type { MetadataRoute } from "next";
import { publicListingIds } from "@/lib/server-api";
import { siteUrl } from "@/lib/site";

// Built at request time (the API need not be up at build); the listing fetch is cached for an hour.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/lands`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/how-it-works`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/sell`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
  const listings = await publicListingIds();
  return [
    ...pages,
    ...listings.map((l) => ({
      url: `${siteUrl}/lands/${l.id}`,
      lastModified: new Date(l.updatedAt),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
