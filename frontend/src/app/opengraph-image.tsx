import { ogCard, ogSize } from "@/lib/og";

export const alt = "DesMind Lands: land sold directly, owner to buyer. No agents.";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    eyebrow: "Land in Enugu State",
    title: "Sell your land. Keep every naira.",
    facts: ["No agents", "Witnessed agreement", "Payments on record"],
    seal: "Every title searched",
  });
}
