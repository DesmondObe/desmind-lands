import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Agent, LAND, makeAdmin, signUp, startApp, system, upload } from "./helpers.ts";

let app: FastifyInstance;
let pool: pg.Pool;

beforeAll(async () => {
  ({ app, pool } = await startApp());
});
afterAll(async () => {
  await app.close();
  await pool.end();
});

/** A listing taken through review onto the market. */
async function liveListing(seller: Agent, admin: Agent, overrides: Partial<typeof LAND> = {}) {
  const created = await seller.post("/listings", { ...LAND, ...overrides });
  expect(created.status).toBe(201);
  const id = created.body.listing.id as string;
  await upload(seller, { listingId: id }, "photo");
  await upload(seller, { listingId: id }, "title_document", "application/pdf");
  expect((await seller.post(`/listings/${id}/status`, { status: "in_review" })).status).toBe(200);
  expect((await admin.post(`/listings/${id}/status`, { status: "published" })).status).toBe(200);
  return id;
}

/** The witness link's token, read from the outbox as the email would carry it. */
async function lastWitnessToken() {
  const { rows } = await system().query(
    "select payload->>'token' as token from outbox where kind = 'witness.invited' order by id desc limit 1",
  );
  return rows[0].token as string;
}

describe("listings", () => {
  it("are reviewed before they are public, and hide the address from strangers", async () => {
    const seller = await signUp(app, "Chidi Eze");
    const admin = await signUp(app, "Review Staff");
    await makeAdmin(admin);
    const stranger = await signUp(app, "Nosy Neighbour");

    const created = await seller.post("/listings", LAND);
    const id = created.body.listing.id;
    // A draft is the seller's alone.
    expect((await stranger.get(`/listings/${id}`)).status).toBe(404);
    // No photo, no review.
    expect((await seller.post(`/listings/${id}/status`, { status: "in_review" })).status).toBe(422);
    await upload(seller, { listingId: id }, "photo");
    expect((await seller.post(`/listings/${id}/status`, { status: "in_review" })).status).toBe(200);
    // A seller cannot publish their own land.
    expect((await seller.post(`/listings/${id}/status`, { status: "published" })).status).toBe(409);
    expect((await admin.post(`/listings/${id}/status`, { status: "published" })).status).toBe(200);

    const seen = await stranger.get(`/listings/${id}`);
    expect(seen.status).toBe(200);
    expect(seen.body.listing.addressLine).toBe("");
    expect(seen.body.listing.titleReference).toBe("");
    expect(seen.body.photos).toHaveLength(1);
    const market = await stranger.get("/listings?q=Emene");
    expect(market.body.listings.map((l: { id: string }) => l.id)).toContain(id);
    // Location is fixed once reviewed.
    expect((await seller.patch(`/listings/${id}`, { town: "Elsewhere" })).status).toBe(409);
    expect((await seller.patch(`/listings/${id}`, { priceKobo: 1_400_000_000 })).status).toBe(200);
  });
});

describe("a deal, from offer to handover", () => {
  it("runs seller, buyer and witnesses through every stage", async () => {
    const seller = await signUp(app, "Chidi Eze");
    const buyer = await signUp(app, "Amaka Obi");
    const rival = await signUp(app, "Second Buyer");
    const admin = await signUp(app, "Review Staff");
    await makeAdmin(admin);
    const listingId = await liveListing(seller, admin);

    // Seller cannot buy their own land.
    expect((await seller.post(`/listings/${listingId}/deals`, { amountKobo: 1_000_000_000 })).status).toBe(409);

    // Offer, counter, accept.
    const opened = await buyer.post(`/listings/${listingId}/deals`, { amountKobo: 1_200_000_000, note: "Cash ready" });
    expect(opened.status).toBe(201);
    const dealId = opened.body.deal.id;
    const rivalDeal = await rival.post(`/listings/${listingId}/deals`, { amountKobo: 1_100_000_000 });
    expect(rivalDeal.status).toBe(201);
    // The rival cannot see this deal.
    expect((await rival.get(`/deals/${dealId}`)).status).toBe(404);

    let room = await seller.get(`/deals/${dealId}`);
    expect(room.body.role).toBe("seller");
    const firstOffer = room.body.offers[0].id;
    // You do not accept your own offer.
    expect((await buyer.post(`/deals/${dealId}/offers/${firstOffer}/accept`)).status).toBe(403);
    expect((await seller.post(`/deals/${dealId}/offers`, { amountKobo: 1_350_000_000 })).status).toBe(200);
    room = await buyer.get(`/deals/${dealId}`);
    const counter = room.body.offers.find((o: { status: string }) => o.status === "open");
    expect(counter.amountKobo).toBe(1_350_000_000);
    expect((await buyer.post(`/deals/${dealId}/offers/${counter.id}/accept`)).status).toBe(200);

    // The land is under offer; the rival can no longer get an offer accepted.
    expect((await rival.get(`/listings/${listingId}`)).body.listing.status).toBe("under_offer");
    const rivalRoom = await seller.get(`/deals/${rivalDeal.body.deal.id}`);
    const rivalOffer = rivalRoom.body.offers[0].id;
    expect((await seller.post(`/deals/${rivalDeal.body.deal.id}/offers/${rivalOffer}/accept`)).status).toBe(409);

    // The buyer now sees the address and title papers.
    const detail = await buyer.get(`/listings/${listingId}`);
    expect(detail.body.listing.addressLine).toBe(LAND.addressLine);
    expect(detail.body.papers.length).toBe(1);

    // Checks: only the seller gives the bank account, only the buyer ticks the checklist.
    expect(
      (
        await buyer.patch(`/deals/${dealId}/terms`, {
          bankName: "X",
          bankAccountNumber: "0123456789",
          bankAccountName: "Y",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await seller.patch(`/deals/${dealId}/terms`, {
          bankName: "Zenith Bank",
          bankAccountNumber: "0123456789",
          bankAccountName: "Chidi Eze",
        })
      ).status,
    ).toBe(200);
    expect((await buyer.post(`/deals/${dealId}/agreement`)).status).toBe(422); // no completion date
    const soon = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    expect(
      (await seller.patch(`/deals/${dealId}/terms`, { completionDate: soon, specialTerms: "Seller clears the bush." }))
        .status,
    ).toBe(200);
    expect((await buyer.post(`/deals/${dealId}/agreement`)).status).toBe(422); // not visited
    expect(
      (await buyer.patch(`/deals/${dealId}/terms`, { checklist: { visited: true, registry_search: true } })).status,
    ).toBe(200);
    expect((await seller.post(`/deals/${dealId}/agreement`)).status).toBe(403);
    expect((await buyer.post(`/deals/${dealId}/agreement`)).status).toBe(200);

    room = await seller.get(`/deals/${dealId}`);
    expect(room.body.deal.stage).toBe("agreement");
    expect(room.body.deal.agreementText).toContain("Chidi Eze");
    expect(room.body.deal.agreementText).toContain("₦13,500,000");
    expect(room.body.deal.agreementText).toContain("Seller clears the bush.");
    const hash = room.body.deal.agreementHash;

    // Signing: own name only.
    expect(
      (await seller.post(`/deals/${dealId}/sign`, { signedName: "Someone Else", agreementHash: hash, consent: true }))
        .status,
    ).toBe(422);
    expect(
      (await seller.post(`/deals/${dealId}/sign`, { signedName: "chidi  eze", agreementHash: hash, consent: true }))
        .status,
    ).toBe(200);
    expect(
      (await buyer.post(`/deals/${dealId}/sign`, { signedName: "Amaka Obi", agreementHash: hash, consent: true }))
        .status,
    ).toBe(200);

    // Witnesses: a party cannot witness, and each side needs its own.
    expect(
      (await seller.post(`/deals/${dealId}/witnesses`, { fullName: "Amaka Obi", email: "a@b.example" })).status,
    ).toBe(422);
    const sw = await seller.post(`/deals/${dealId}/witnesses`, { fullName: "Ngozi Eze", email: "ngozi@test.example" });
    expect(sw.status).toBe(201);
    const sellerToken = await lastWitnessToken();
    expect(sw.body.link).toContain(sellerToken);

    const anon = new (await import("./helpers.ts")).Agent(app);
    const view = await anon.get(`/witness/${sellerToken}`);
    expect(view.status).toBe(200);
    expect(view.body.seller).toBe("Chidi Eze");
    expect(view.body.deal.agreementHash).toBe(hash);
    const sign = (token: string, name: string) =>
      anon.post(`/witness/${token}/sign`, {
        signedName: name,
        address: "12 Ogui Road, Enugu",
        occupation: "Teacher",
        agreementHash: hash,
        consent: true,
      });
    expect((await sign(sellerToken, "Wrong Name")).status).toBe(422);
    expect((await sign(sellerToken, "Ngozi Eze")).status).toBe(200);
    expect((await sign(sellerToken, "Ngozi Eze")).status).toBe(409);
    expect((await anon.get("/witness/not-a-real-token-at-all-xxxxxxxx")).status).toBe(404);

    // Still waiting on the buyer's witness.
    room = await buyer.get(`/deals/${dealId}`);
    expect(room.body.deal.stage).toBe("agreement");
    await buyer.post(`/deals/${dealId}/witnesses`, { fullName: "Emeka Obi", phone: "08031234567" });
    // No email: the buyer shares the link themselves. A fresh link replaces the old one.
    const bw = room.body.witnesses;
    expect(bw).toHaveLength(1);
    room = await buyer.get(`/deals/${dealId}`);
    const buyerWitness = room.body.witnesses.find((w: { side: string }) => w.side === "buyer");
    const relink = await buyer.post(`/deals/${dealId}/witnesses/${buyerWitness.id}/link`);
    const buyerToken = relink.body.link.split("/witness/")[1];
    expect((await sign(buyerToken, "Emeka Obi")).status).toBe(200);

    room = await buyer.get(`/deals/${dealId}`);
    expect(room.body.deal.stage).toBe("payment");

    // Payment: the buyer records it, with a receipt; only the seller confirms.
    const proof = await upload(buyer, { dealId }, "payment_proof", "application/pdf");
    const today = new Date().toISOString().slice(0, 10);
    const part = await buyer.post(`/deals/${dealId}/payments`, {
      amountKobo: 1_000_000_000,
      method: "transfer",
      reference: "ZEN-0001",
      paidOn: today,
      proofFileId: proof,
      signedName: "Amaka Obi",
    });
    expect(part.status).toBe(201);
    expect((await buyer.post(`/deals/${dealId}/payments/${part.body.payment.id}/confirm`)).status).toBe(403);
    expect((await seller.post(`/deals/${dealId}/payments/${part.body.payment.id}/confirm`)).status).toBe(200);
    expect((await seller.post(`/deals/${dealId}/handover`)).status).toBe(409); // not paid in full

    const rest = await buyer.post(`/deals/${dealId}/payments`, {
      amountKobo: 350_000_000,
      method: "cash",
      paidOn: today,
      signedName: "Amaka Obi",
    });
    expect((await seller.post(`/deals/${dealId}/payments/${rest.body.payment.id}/confirm`)).status).toBe(200);
    expect((await buyer.post(`/deals/${dealId}/handover`)).status).toBe(409); // seller first
    expect((await seller.post(`/deals/${dealId}/handover`)).status).toBe(200);
    expect((await buyer.post(`/deals/${dealId}/handover`)).status).toBe(200);

    room = await buyer.get(`/deals/${dealId}`);
    expect(room.body.deal.stage).toBe("completed");
    expect((await rival.get(`/listings/${listingId}`)).body.listing.status).toBe("sold");
    // Every other conversation about the land has ended.
    expect((await rival.get(`/deals/${rivalDeal.body.deal.id}`)).body.deal.stage).toBe("cancelled");

    const pdf = await buyer.get(`/deals/${dealId}/agreement.pdf`);
    expect(pdf.status).toBe(200);
    expect(Buffer.from(pdf.body).subarray(0, 4).toString()).toBe("%PDF");

    const stats = await rival.get("/stats");
    expect(stats.body.sold).toBeGreaterThanOrEqual(1);
  });

  it("lapses every signature when the terms are reopened", async () => {
    const seller = await signUp(app, "Bola Ade");
    const buyer = await signUp(app, "Tunde Bello");
    const admin = await signUp(app, "Review Staff");
    await makeAdmin(admin);
    const listingId = await liveListing(seller, admin, { negotiable: false });
    // A fixed price takes only that price.
    expect((await buyer.post(`/listings/${listingId}/deals`, { amountKobo: 1_000_000_000 })).status).toBe(422);
    const dealId = (await buyer.post(`/listings/${listingId}/deals`, { amountKobo: LAND.priceKobo })).body.deal.id;
    const offer = (await seller.get(`/deals/${dealId}`)).body.offers[0].id;
    await seller.post(`/deals/${dealId}/offers/${offer}/accept`);
    await seller.patch(`/deals/${dealId}/terms`, {
      bankName: "GTBank",
      bankAccountNumber: "0011223344",
      bankAccountName: "Bola Ade",
      completionDate: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
    });
    await buyer.patch(`/deals/${dealId}/terms`, { checklist: { visited: true } });
    await buyer.post(`/deals/${dealId}/agreement`);
    const hash = (await seller.get(`/deals/${dealId}`)).body.deal.agreementHash;
    await seller.post(`/deals/${dealId}/sign`, { signedName: "Bola Ade", agreementHash: hash, consent: true });
    expect((await buyer.post(`/deals/${dealId}/revise`, { reason: "Completion date too soon" })).status).toBe(200);
    const room = await seller.get(`/deals/${dealId}`);
    expect(room.body.deal.stage).toBe("checks");
    expect(room.body.signatures).toHaveLength(0);
    // Cancelling puts the land back on the market.
    expect((await buyer.post(`/deals/${dealId}/cancel`, { reason: "Changed my mind" })).status).toBe(200);
    expect((await buyer.get(`/listings/${listingId}`)).body.listing.status).toBe("published");
  });
});
