import type { Metadata } from "next";
import type { ReactNode } from "react";
import { formatSize, LAND_USE, shortNaira, TITLE_LABEL } from "@/lib/land";
import { publicListing } from "@/lib/server-api";
import { siteUrl } from "@/lib/site";

/**
 * The listing page itself is interactive (a client component); this server layout gives it
 * what a shared link needs: a real title and description, a preview card (opengraph-image.tsx)
 * for WhatsApp and the rest, and structured data for search engines.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const l = await publicListing(id);
  if (!l) return { title: "Land for sale", robots: { index: false } };
  const where = [l.town, l.lga, `${l.state} State`].filter(Boolean).join(", ");
  const title = `${l.title}: ${shortNaira(l.priceKobo)}`;
  const description = [
    `${formatSize(l.sizeValue, l.sizeUnit)} of ${LAND_USE[l.landUse]?.toLowerCase() ?? "land"} in ${where}.`,
    `${TITLE_LABEL[l.titleKind] ?? "Title"}${l.titleSearchedAt ? ", searched at the Ministry of Lands" : ""}.`,
    l.status === "sold" ? "Sold directly by its owner." : "Buy directly from the owner: no agent, no commission.",
  ].join(" ");
  return {
    title,
    description,
    alternates: { canonical: `/lands/${l.id}` },
    openGraph: { type: "website", title, description, url: `/lands/${l.id}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ListingLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const l = await publicListing(id);
  const jsonLd = l && {
    "@context": "https://schema.org",
    "@type": "Product",
    name: l.title,
    description: l.description || undefined,
    url: `${siteUrl}/lands/${l.id}`,
    category: `Land: ${LAND_USE[l.landUse] ?? l.landUse}`,
    offers: {
      "@type": "Offer",
      price: (l.priceKobo / 100).toFixed(0),
      priceCurrency: "NGN",
      availability: l.status === "sold" ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      areaServed: `${l.town}, ${l.state}, Nigeria`,
    },
  };
  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD, escaped so a title cannot close the tag.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      )}
      {children}
    </>
  );
}
