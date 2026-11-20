import { cache } from "react";

/**
 * Server code only (layouts, metadata, OG images, the sitemap): never import this from a
 * "use client" file. The API as the web server sees it. Calls are
 * anonymous (no cookie), so they only ever see what the public sees, and are cached briefly:
 * a price change shows in a shared link within minutes.
 */
const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");

async function get<T>(path: string, revalidate = 300): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      next: { revalidate },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    // The API is down, or this is a build without one: pages fall back to the site's defaults.
    return null;
  }
}

export type PublicListing = {
  id: string;
  title: string;
  description: string;
  state: string;
  lga: string;
  town: string;
  sizeValue: number;
  sizeUnit: string;
  priceKobo: number;
  negotiable: boolean;
  landUse: string;
  titleKind: string;
  status: string;
  titleSearchedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

/** One listing as the public sees it; null if it is not public (a draft) or cannot be fetched. */
export const publicListing = cache(async (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const data = await get<{ listing: PublicListing }>(`/listings/${id}`);
  const l = data?.listing;
  return l && ["published", "under_offer", "sold"].includes(l.status) ? l : null;
});

/** Every listing on the market, or sold, for the sitemap. */
export async function publicListingIds(): Promise<{ id: string; updatedAt: string }[]> {
  const out: { id: string; updatedAt: string }[] = [];
  for (let page = 1; page <= 50; page++) {
    const data = await get<{
      listings: { id: string; publishedAt: string | null; createdAt: string }[];
      pages: number;
    }>(`/listings?includeSold=true&limit=60&page=${page}`, 3600);
    if (!data) break;
    for (const l of data.listings) out.push({ id: l.id, updatedAt: l.publishedAt ?? l.createdAt });
    if (page >= data.pages) break;
  }
  return out;
}
