const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

/** Whole kobo → "₦25,000,000". */
export const formatKobo = (kobo: number | null | undefined) => (kobo == null ? "—" : naira.format(kobo / 100));

/** "2026-09-01" → "1 September 2026", in UTC so nothing shifts it. */
/**
 * Today's date (YYYY-MM-DD) where the land is. Nigeria is an hour ahead of UTC, so a payment
 * made just after midnight in Enugu is dated "tomorrow" by the UTC calendar.
 */
export function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

export function formatDay(day: string | Date | null | undefined) {
  if (!day) return "—";
  const d = typeof day === "string" ? new Date(day.length === 10 ? `${day}T00:00:00Z` : day) : day;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** A moment, as people in Nigeria read it: "3 March 2026, 14:05 (WAT)". */
export function formatMoment(at: string | Date | null | undefined) {
  if (!at) return "—";
  const d = typeof at === "string" ? new Date(at) : at;
  return `${d.toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  })} (WAT)`;
}

/** Naira in words, for the agreement: 25000000 kobo → "Two Hundred and Fifty Thousand Naira". */
export function nairaInWords(kobo: number) {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const under1000 = (n: number): string => {
    const h = Math.floor(n / 100);
    const r = n % 100;
    const rest = r < 20 ? ones[r]! : `${tens[Math.floor(r / 10)]}${r % 10 ? `-${ones[r % 10]}` : ""}`;
    if (!h) return rest;
    return `${ones[h]} Hundred${r ? ` and ${rest}` : ""}`;
  };
  const scales: [number, string][] = [
    [1e12, "Trillion"],
    [1e9, "Billion"],
    [1e6, "Million"],
    [1e3, "Thousand"],
  ];
  let n = Math.floor(kobo / 100);
  if (n === 0) return "Zero Naira";
  const parts: string[] = [];
  for (const [value, name] of scales) {
    if (n >= value) {
      parts.push(`${under1000(Math.floor(n / value))} ${name}`);
      n %= value;
    }
  }
  if (n) parts.push(n < 100 && parts.length ? `and ${under1000(n)}` : under1000(n));
  const k = kobo % 100;
  return `${parts.join(" ")} Naira${k ? ` and ${under1000(k)} Kobo` : ""}`;
}
