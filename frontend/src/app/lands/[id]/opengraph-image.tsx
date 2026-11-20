import { formatSize, LAND_USE, shortNaira, TITLE_SHORT } from "@/lib/land";
import { ogCard, ogSize } from "@/lib/og";
import { publicListing } from "@/lib/server-api";

export const alt = "Land for sale on DesMind Lands";
export const size = ogSize;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const l = await publicListing(id);
  if (!l)
    return ogCard({
      eyebrow: "Land in Enugu State",
      title: "Buy land straight from the owner.",
      facts: ["No agents", "No commission"],
    });
  return ogCard({
    eyebrow: [l.town, l.lga].filter(Boolean).join(", "),
    // Satori's built-in font has no naira sign, so the price is spelt with its currency code.
    price: shortNaira(l.priceKobo).replace("₦", "NGN "),
    title: l.title,
    facts: [
      formatSize(l.sizeValue, l.sizeUnit).replace("m²", "sqm"),
      LAND_USE[l.landUse] ?? "",
      TITLE_SHORT[l.titleKind] ?? "",
      ...(l.status === "sold" ? ["Sold"] : l.status === "under_offer" ? ["Under offer"] : []),
    ].filter(Boolean),
    seal: l.titleSearchedAt ? "Title searched" : undefined,
  });
}
