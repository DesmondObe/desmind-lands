/** The words for land: titles, sizes, uses and features, as the API's enums name them. */

export const TITLE_LABEL: Record<string, string> = {
  c_of_o: "Certificate of Occupancy",
  governors_consent: "Governor's Consent",
  deed_of_assignment: "Registered Deed of Assignment",
  registered_survey: "Registered Survey Plan",
  gazette: "Gazette",
  excision: "Excision",
  customary_right: "Customary Right of Occupancy",
  family_receipt: "Family receipt and agreement",
  other: "Other document",
};

export const TITLE_SHORT: Record<string, string> = {
  c_of_o: "C of O",
  governors_consent: "Gov. Consent",
  deed_of_assignment: "Deed",
  registered_survey: "Survey",
  gazette: "Gazette",
  excision: "Excision",
  customary_right: "Customary",
  family_receipt: "Family receipt",
  other: "Other",
};

/** How strong each title is, roughly: shown as a bar, with a word of explanation. */
export const TITLE_STRENGTH: Record<string, { level: 1 | 2 | 3; note: string }> = {
  c_of_o: { level: 3, note: "The strongest title: a grant from the state government." },
  governors_consent: { level: 3, note: "The state has approved a transfer of a titled plot." },
  deed_of_assignment: { level: 2, note: "Transfer from a previous owner. Check it is registered." },
  gazette: { level: 3, note: "Land released by government and published in the state gazette." },
  excision: { level: 2, note: "Released from government acquisition to the community." },
  registered_survey: { level: 2, note: "Surveyed and registered. Chart it with the Surveyor-General." },
  customary_right: { level: 2, note: "Granted by a local government over non-urban land." },
  family_receipt: { level: 1, note: "Common, but the weakest. Confirm the family's title and consent." },
  other: { level: 1, note: "Have a lawyer review what the document is." },
};

export const LAND_USE: Record<string, string> = {
  residential: "Residential",
  commercial: "Commercial",
  agricultural: "Farmland",
  industrial: "Industrial",
  mixed: "Mixed use",
};

export const SIZE_UNIT: Record<string, [string, string]> = {
  plot: ["plot", "plots"],
  sqm: ["m²", "m²"],
  acre: ["acre", "acres"],
  hectare: ["hectare", "hectares"],
};

export function formatSize(value: number, unit: string) {
  const [one, many] = SIZE_UNIT[unit] ?? [unit, unit];
  const n = Number(value).toLocaleString("en-NG", { maximumFractionDigits: 2 });
  return unit === "sqm" ? `${n} m²` : `${n} ${Number(value) === 1 ? one : many}`;
}

export const FEATURES: Record<string, string> = {
  fenced: "Fenced",
  gated_estate: "Gated estate",
  dry_land: "Dry land",
  road_access: "Road access",
  tarred_road: "Tarred road",
  electricity: "Electricity nearby",
  water: "Water nearby",
  corner_piece: "Corner piece",
  survey_done: "Survey done",
  beacons_in_place: "Beacons in place",
  no_family_claims: "No family claims",
  near_express: "Near expressway",
};

/**
 * Where DesMind Lands operates. Launch is Enugu State only; to open another state, add it here
 * with its local government areas (and the same in backend/src/lib/regions.ts).
 */
export const SERVED: Record<string, readonly string[]> = {
  Enugu: [
    "Aninri",
    "Awgu",
    "Enugu East",
    "Enugu North",
    "Enugu South",
    "Ezeagu",
    "Igbo Etiti",
    "Igbo Eze North",
    "Igbo Eze South",
    "Isi Uzo",
    "Nkanu East",
    "Nkanu West",
    "Nsukka",
    "Oji River",
    "Udenu",
    "Udi",
    "Uzo-Uwani",
  ],
};
export const SERVED_STATES = Object.keys(SERVED);
/** The one state at launch: its name, and its local government areas for search and listing. */
export const HOME_STATE = SERVED_STATES[0] ?? "Enugu";
export const HOME_LGAS = SERVED[HOME_STATE] ?? [];
/** Popular areas, for quick search: the city and the towns buyers ask for most. */
export const POPULAR_AREAS = [
  "Independence Layout",
  "Trans-Ekulu",
  "Emene",
  "GRA",
  "New Haven",
  "Nsukka",
  "Ngwo",
  "Abakpa",
];

/** Every state, for when DesMind Lands grows beyond Enugu. */
export const STATES = [
  "Abia",
  "Abuja (FCT)",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
];

export const LISTING_STATUS: Record<string, string> = {
  draft: "Draft",
  in_review: "In review",
  published: "On the market",
  under_offer: "Under offer",
  sold: "Sold",
  withdrawn: "Withdrawn",
  rejected: "Needs changes",
};

export const STAGES = [
  { key: "negotiating", label: "Offer", long: "Agree a price" },
  { key: "checks", label: "Checks", long: "Inspect and verify" },
  { key: "agreement", label: "Sign", long: "Sign with witnesses" },
  { key: "payment", label: "Pay", long: "Pay and hand over" },
  { key: "completed", label: "Done", long: "Sold" },
] as const;

export const STAGE_LABEL: Record<string, string> = {
  negotiating: "Negotiating",
  checks: "Checks",
  agreement: "Signing",
  payment: "Payment",
  completed: "Completed",
  cancelled: "Cancelled",
};

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });
export const formatKobo = (kobo: number | null | undefined) => (kobo == null ? "—" : naira.format(kobo / 100));

/** ₦45m, ₦1.2bn, ₦850k: prices at a glance, on cards. */
export function shortNaira(kobo: number) {
  const n = kobo / 100;
  const fmt = (v: number) => (v >= 100 ? Math.round(v).toString() : v.toFixed(1).replace(/\.0$/, ""));
  if (n >= 1e9) return `₦${fmt(n / 1e9)}bn`;
  if (n >= 1e6) return `₦${fmt(n / 1e6)}m`;
  if (n >= 1e3) return `₦${fmt(n / 1e3)}k`;
  return `₦${n}`;
}

/** Naira typed by a person → kobo. Accepts "25,000,000", "25m" and "1.5bn". */
export function nairaToKobo(input: string): number | null {
  const s = input.replace(/[,\s₦]/g, "").toLowerCase();
  const m = s.match(/^(\d+(?:\.\d+)?)(k|m|bn|b)?$/);
  if (!m) return null;
  const mult = { k: 1e3, m: 1e6, bn: 1e9, b: 1e9 }[m[2] ?? ""] ?? 1;
  const n = Number(m[1]) * mult;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

export function formatDay(day: string | null | undefined) {
  if (!day) return "—";
  const d = new Date(day.length === 10 ? `${day}T00:00:00Z` : day);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatMoment(at: string | null | undefined) {
  if (!at) return "—";
  return new Date(at).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(at: string) {
  const s = (Date.now() - new Date(at).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return formatDay(at);
}

/** What agents would have taken: 5–10% from each side. */
export function agentCut(kobo: number) {
  return { low: kobo * 0.05 * 2, high: kobo * 0.1 * 2 };
}
