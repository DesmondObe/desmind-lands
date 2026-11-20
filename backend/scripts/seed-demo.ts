/**
 * Demo data for a local or staging site, made through the API as people would make it:
 * three sellers with land on the market, a buyer, and a staff reviewer.
 *   npm run seed:demo --workspace @lands/backend
 * Every demo account's password is "demo password 123" and its email ends in @demo.test.
 * Refuses to run against production.
 */
import pg from "pg";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed demo data in production.");
  process.exit(1);
}
const API = process.env.API_URL ?? "http://localhost:4000";
const system = process.env.SYSTEM_DATABASE_URL;
if (!system) {
  console.error("Set SYSTEM_DATABASE_URL.");
  process.exit(1);
}
const PASSWORD = "demo password 123";

async function call(cookie: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data: any = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path}: ${data?.error ?? res.status}`);
  return { data, cookie: res.headers.get("set-cookie")?.split(";")[0] ?? cookie };
}

async function account(email: string, fullName: string, phone = "") {
  try {
    return (await call("", "POST", "/auth/register", { email, password: PASSWORD, fullName, phone })).cookie;
  } catch {
    return (await call("", "POST", "/auth/login", { email, password: PASSWORD })).cookie;
  }
}

/** A tiny PNG: one pixel of laterite red, so a listing can pass review. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64",
);

async function photo(cookie: string, listingId: string) {
  const { data } = await call(cookie, "POST", "/files/uploads", {
    listingId,
    kind: "photo",
    filename: "land.png",
    contentType: "image/png",
    sizeBytes: PIXEL.length,
  });
  const url = new URL(data.upload.url);
  await fetch(`${API}${url.pathname.replace(/^\/api/, "")}${url.search}`, {
    method: "PUT",
    headers: { "content-type": "image/png" },
    body: PIXEL,
  });
  await call(cookie, "POST", `/files/${data.file.id}/complete`, {});
  return data.file.id as string;
}

const db = new pg.Client({ connectionString: system });
await db.connect();

const admin = await account("reviewer@demo.test", "Ifeoma Review", "08030000001");
await db.query("update users set platform_role = 'admin' where email = 'reviewer@demo.test'");
const sellers = {
  chidi: await account("chidi@demo.test", "Chidi Emmanuel Eze", "08031234567"),
  bola: await account("bola@demo.test", "Bolanle Adeyemi", "08029876543"),
  musa: await account("musa@demo.test", "Musa Ibrahim Danladi", "08061112233"),
};
await account("amaka@demo.test", "Amaka Obi", "08097654321");

const land = [
  [
    sellers.chidi,
    {
      title: "Two dry plots off the airport road, Emene",
      state: "Enugu",
      lga: "Enugu East",
      town: "Emene",
      sizeValue: 2,
      sizeUnit: "plot",
      priceKobo: 1_350_000_000,
      landUse: "residential",
      titleKind: "c_of_o",
      features: ["dry_land", "fenced", "road_access", "beacons_in_place"],
      description:
        "Two adjoining dry plots in a quiet, built-up layout ten minutes from the airport road. Fenced on three sides, beacons in place, and a motorable road to the gate. Good neighbours on both sides.",
    },
  ],
  [
    sellers.chidi,
    {
      title: "Corner plot in Trans-Ekulu, close to the market",
      state: "Enugu",
      lga: "Enugu East",
      town: "Trans-Ekulu",
      sizeValue: 1,
      sizeUnit: "plot",
      priceKobo: 2_800_000_000,
      landUse: "residential",
      titleKind: "governors_consent",
      features: ["corner_piece", "tarred_road", "electricity", "water"],
      description: "A corner plot on a tarred street in Trans-Ekulu, with light and water at the boundary.",
    },
  ],
  [
    sellers.bola,
    {
      title: "Half plot in a gated estate, Ibeju-Lekki",
      state: "Lagos",
      lga: "Ibeju-Lekki",
      town: "Eleko",
      sizeValue: 300,
      sizeUnit: "sqm",
      priceKobo: 900_000_000,
      landUse: "residential",
      titleKind: "gazette",
      features: ["gated_estate", "dry_land", "survey_done", "near_express"],
      description:
        "300 m² in a gated estate five minutes from the Lekki–Epe expressway. Excised and gazetted; estate roads are graded.",
    },
  ],
  [
    sellers.bola,
    {
      title: "Commercial frontage on the Abeokuta road",
      state: "Ogun",
      lga: "Ifo",
      town: "Ifo",
      sizeValue: 1200,
      sizeUnit: "sqm",
      priceKobo: 4_500_000_000,
      negotiable: false,
      landUse: "commercial",
      titleKind: "deed_of_assignment",
      features: ["tarred_road", "electricity", "road_access"],
      description: "1,200 m² fronting the main Abeokuta road. Ideal for a filling station, warehouse or shops.",
    },
  ],
  [
    sellers.musa,
    {
      title: "Five acres of farmland by the river, Kuje",
      state: "Abuja (FCT)",
      lga: "Kuje",
      town: "Gaube",
      sizeValue: 5,
      sizeUnit: "acre",
      priceKobo: 1_750_000_000,
      landUse: "agricultural",
      titleKind: "customary_right",
      features: ["water", "road_access", "no_family_claims"],
      description:
        "Fertile, well-drained farmland with river frontage and a laterite road to the village. Currently under maize.",
    },
  ],
  [
    sellers.musa,
    {
      title: "Two hectares for a factory, Kano–Zaria road",
      state: "Kano",
      lga: "Kumbotso",
      town: "Challawa",
      sizeValue: 2,
      sizeUnit: "hectare",
      priceKobo: 12_000_000_000,
      landUse: "industrial",
      titleKind: "c_of_o",
      features: ["tarred_road", "electricity", "fenced"],
      description: "Level industrial land near the Challawa industrial estate, with a three-phase line along the road.",
    },
  ],
] as const;

const { rows: existing } = await db.query(
  "select count(*)::int as n from listings l join users u on u.id = l.seller_id where u.email like '%@demo.test'",
);
if (existing[0].n > 0) {
  console.log("Demo listings already exist; accounts refreshed.");
} else {
  for (const [cookie, body] of land) {
    const { data } = await call(cookie, "POST", "/listings", body);
    await photo(cookie, data.listing.id);
    await call(cookie, "POST", `/listings/${data.listing.id}/status`, { status: "in_review" });
    await call(admin, "POST", `/listings/${data.listing.id}/status`, { status: "published" });
  }
  // The demo photo is a single pixel: drop it, so cards show their survey plans instead.
  await db.query("delete from files where kind = 'photo' and filename = 'land.png'");
  console.log(`Seeded ${land.length} listings.`);
}
await db.end();
console.log(`Demo accounts (password "${PASSWORD}"): reviewer@, chidi@, bola@, musa@, amaka@demo.test`);
