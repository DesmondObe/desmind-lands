import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/* Mirrors migrations/. The migrations are the source of truth; this is how the API reads them. */

const id = () => uuid("id").primaryKey().default(sql`uuidv7()`);
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });
const kobo = (name: string) => bigint(name, { mode: "number" });

export const platformRole = pgEnum("platform_role", ["admin"]);
export const landUse = pgEnum("land_use", ["residential", "commercial", "agricultural", "industrial", "mixed"]);
export const TITLE_KINDS = [
  "c_of_o",
  "governors_consent",
  "deed_of_assignment",
  "registered_survey",
  "gazette",
  "excision",
  "customary_right",
  "family_receipt",
  "other",
] as const;
export const titleKind = pgEnum("title_kind", TITLE_KINDS);
export const sizeUnit = pgEnum("size_unit", ["plot", "sqm", "acre", "hectare"]);
export const listingStatus = pgEnum("listing_status", [
  "draft",
  "in_review",
  "published",
  "under_offer",
  "sold",
  "withdrawn",
  "rejected",
]);
export const dealStage = pgEnum("deal_stage", [
  "negotiating",
  "checks",
  "agreement",
  "payment",
  "completed",
  "cancelled",
]);
export const dealSide = pgEnum("deal_side", ["seller", "buyer"]);
export const offerStatus = pgEnum("offer_status", ["open", "accepted", "declined", "withdrawn", "superseded"]);
export const fileKind = pgEnum("file_kind", [
  "photo",
  "title_document",
  "survey_plan",
  "payment_proof",
  "identity",
  "other",
]);
export const paymentStatus = pgEnum("payment_status", ["submitted", "confirmed", "disputed"]);

export type DealStage = (typeof dealStage.enumValues)[number];
export type DealSide = (typeof dealSide.enumValues)[number];
export type FileKind = (typeof fileKind.enumValues)[number];

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull().default(""),
  platformRole: platformRole("platform_role"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const publicProfiles = pgTable("public_profiles", {
  id: uuid("id").notNull(),
  fullName: text("full_name").notNull(),
  createdAt: ts("created_at").notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ip: text("ip").notNull().default(""),
  userAgent: text("user_agent").notNull().default(""),
});

export const listings = pgTable("listings", {
  id: id(),
  sellerId: uuid("seller_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  state: text("state").notNull(),
  lga: text("lga").notNull().default(""),
  town: text("town").notNull(),
  addressLine: text("address_line").notNull().default(""),
  sizeValue: numeric("size_value", { precision: 12, scale: 2, mode: "number" }).notNull(),
  sizeUnit: sizeUnit("size_unit").notNull().default("plot"),
  priceKobo: kobo("price_kobo").notNull(),
  negotiable: boolean("negotiable").notNull().default(true),
  landUse: landUse("land_use").notNull().default("residential"),
  titleKind: titleKind("title_kind").notNull(),
  titleReference: text("title_reference").notNull().default(""),
  features: text("features").array().notNull().default(sql`'{}'`),
  latitude: numeric("latitude", { precision: 9, scale: 6, mode: "number" }),
  longitude: numeric("longitude", { precision: 9, scale: 6, mode: "number" }),
  status: listingStatus("status").notNull().default("draft"),
  reviewNote: text("review_note").notNull().default(""),
  reviewedBy: uuid("reviewed_by"),
  publishedAt: ts("published_at"),
  soldAt: ts("sold_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const savedListings = pgTable(
  "saved_listings",
  {
    userId: uuid("user_id").notNull(),
    listingId: uuid("listing_id").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listingId] })],
);

export const deals = pgTable("deals", {
  id: id(),
  listingId: uuid("listing_id").notNull(),
  sellerId: uuid("seller_id").notNull(),
  buyerId: uuid("buyer_id").notNull(),
  stage: dealStage("stage").notNull().default("negotiating"),
  agreedKobo: kobo("agreed_kobo"),
  agreedAt: ts("agreed_at"),
  inspectionAt: ts("inspection_at"),
  inspectionNote: text("inspection_note").notNull().default(""),
  checklist: jsonb("checklist").$type<Record<string, boolean>>().notNull().default({}),
  bankName: text("bank_name").notNull().default(""),
  bankAccountNumber: text("bank_account_number").notNull().default(""),
  bankAccountName: text("bank_account_name").notNull().default(""),
  completionDate: date("completion_date", { mode: "string" }),
  specialTerms: text("special_terms").notNull().default(""),
  agreementText: text("agreement_text"),
  agreementHash: text("agreement_hash"),
  agreementReadyAt: ts("agreement_ready_at"),
  signedAt: ts("signed_at"),
  paidAt: ts("paid_at"),
  sellerHandoverAt: ts("seller_handover_at"),
  buyerReceivedAt: ts("buyer_received_at"),
  completedAt: ts("completed_at"),
  cancelledAt: ts("cancelled_at"),
  cancelledBy: uuid("cancelled_by"),
  cancelReason: text("cancel_reason").notNull().default(""),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const dealOffers = pgTable("deal_offers", {
  id: id(),
  dealId: uuid("deal_id").notNull(),
  authorId: uuid("author_id").notNull(),
  amountKobo: kobo("amount_kobo").notNull(),
  note: text("note").notNull().default(""),
  status: offerStatus("status").notNull().default("open"),
  respondedAt: ts("responded_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const dealMessages = pgTable("deal_messages", {
  id: id(),
  dealId: uuid("deal_id").notNull(),
  authorId: uuid("author_id").notNull(),
  body: text("body").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const dealWitnesses = pgTable("deal_witnesses", {
  id: id(),
  dealId: uuid("deal_id").notNull(),
  side: dealSide("side").notNull(),
  invitedBy: uuid("invited_by"),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  tokenHash: text("token_hash").notNull(),
  address: text("address").notNull().default(""),
  occupation: text("occupation").notNull().default(""),
  signedName: text("signed_name"),
  signedHash: text("signed_hash"),
  signedAt: ts("signed_at"),
  ip: text("ip").notNull().default(""),
  userAgent: text("user_agent").notNull().default(""),
  removedAt: ts("removed_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const dealSignatures = pgTable("deal_signatures", {
  id: id(),
  dealId: uuid("deal_id").notNull(),
  party: dealSide("party").notNull(),
  userId: uuid("user_id").notNull(),
  signedName: text("signed_name").notNull(),
  agreementHash: text("agreement_hash").notNull(),
  ip: text("ip").notNull().default(""),
  userAgent: text("user_agent").notNull().default(""),
  signedAt: ts("signed_at").notNull().defaultNow(),
});

export const files = pgTable("files", {
  id: id(),
  listingId: uuid("listing_id"),
  dealId: uuid("deal_id"),
  kind: fileKind("kind").notNull(),
  storageKey: text("storage_key").notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  ready: boolean("ready").notNull().default(false),
  position: integer("position").notNull().default(0),
  uploadedBy: uuid("uploaded_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const dealPayments = pgTable("deal_payments", {
  id: id(),
  dealId: uuid("deal_id").notNull(),
  amountKobo: kobo("amount_kobo").notNull(),
  method: text("method").$type<"transfer" | "cash" | "cheque" | "other">().notNull(),
  reference: text("reference").notNull().default(""),
  paidOn: date("paid_on", { mode: "string" }).notNull(),
  note: text("note").notNull().default(""),
  proofFileId: uuid("proof_file_id"),
  declaredBy: uuid("declared_by").notNull(),
  signedName: text("signed_name").notNull(),
  status: paymentStatus("status").notNull().default("submitted"),
  responseNote: text("response_note").notNull().default(""),
  respondedAt: ts("responded_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const dealEvents = pgTable("deal_events", {
  id: id(),
  dealId: uuid("deal_id").notNull(),
  actorId: uuid("actor_id"),
  actorLabel: text("actor_label").notNull().default(""),
  kind: text("kind").notNull(),
  summary: text("summary").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});
