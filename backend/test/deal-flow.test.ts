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
  expect((await admin.post(`/admin/listings/${id}/title-search`, { reference: "ENS/MLS/1234" })).status).toBe(200);
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

    // For now, land in Enugu State only.
    expect((await seller.post("/listings", { ...LAND, state: "Lagos", lga: "" })).status).toBe(400);
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
    // Not before its title has been searched at the Ministry of Lands, and only staff record that.
    expect((await admin.post(`/listings/${id}/status`, { status: "published" })).status).toBe(422);
    expect((await seller.post(`/admin/listings/${id}/title-search`, { reference: "ENS/MLS/1" })).status).toBe(403);
    expect((await admin.post(`/admin/listings/${id}/title-search`, { reference: "ENS/MLS/1234" })).status).toBe(200);
    expect((await admin.post(`/listings/${id}/status`, { status: "published" })).status).toBe(200);

    const seen = await stranger.get(`/listings/${id}`);
    expect(seen.status).toBe(200);
    expect(seen.body.listing.addressLine).toBe("");
    expect(seen.body.listing.titleReference).toBe("");
    expect(seen.body.listing.titleSearchedAt).toBeTruthy();
    expect(seen.body.listing.titleSearchRef).toBe("");
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

describe("what the audit found", () => {
  it("lets only one of two buyers accepting at the same moment take the land", async () => {
    const seller = await signUp(app, "Ngozi Ani");
    const admin = await signUp(app, "Review Staff");
    await makeAdmin(admin);
    const listingId = await liveListing(seller, admin);
    // The seller counters two buyers; both say yes at once.
    const accepts = await Promise.all(
      ["First Buyer", "Second Buyer"].map(async (name) => {
        const buyer = await signUp(app, name);
        const dealId = (await buyer.post(`/listings/${listingId}/deals`, { amountKobo: 1_200_000_000 })).body.deal.id;
        await seller.post(`/deals/${dealId}/offers`, { amountKobo: 1_400_000_000 });
        const room = await buyer.get(`/deals/${dealId}`);
        const counter = room.body.offers.find((o: { status: string }) => o.status === "open");
        return () => buyer.post(`/deals/${dealId}/offers/${counter.id}/accept`);
      }),
    );
    const answers = await Promise.all(accepts.map((accept) => accept()));
    expect(answers.map((a) => a.status).sort()).toEqual([200, 409]);
    const { rows } = await system().query(
      "select count(*)::int as n from deals where listing_id = $1 and stage = 'checks'",
      [listingId],
    );
    expect(rows[0].n).toBe(1);
  });

  it("keeps staff's review notes from the buyer, and reads ?includeSold=false as no", async () => {
    const seller = await signUp(app, "Emeka Ugwu");
    const buyer = await signUp(app, "Ifeoma Nnamdi");
    const admin = await signUp(app, "Review Staff");
    await makeAdmin(admin);
    const listingId = await liveListing(seller, admin);
    await system().query("update listings set review_note = 'Seller rang twice about the fee.' where id = $1", [
      listingId,
    ]);
    const dealId = (await buyer.post(`/listings/${listingId}/deals`, { amountKobo: 1_200_000_000 })).body.deal.id;
    expect((await buyer.get(`/deals/${dealId}`)).body.listing.reviewNote).toBe("");
    expect((await seller.get(`/deals/${dealId}`)).body.listing.reviewNote).toContain("fee");

    const statuses = async (query: string) =>
      (await buyer.get(`/listings?limit=60&${query}`)).body.listings.map((l: { status: string }) => l.status);
    expect(await statuses("includeSold=true")).toContain("sold");
    expect(await statuses("includeSold=false")).not.toContain("sold");
  });

  it("holds a fixed price in the deal room, and caps how many witnesses one side can name", async () => {
    const seller = await signUp(app, "Kelechi Odo");
    const buyer = await signUp(app, "Uche Mba");
    const admin = await signUp(app, "Review Staff");
    await makeAdmin(admin);
    const listingId = await liveListing(seller, admin, { negotiable: false });
    const dealId = (await buyer.post(`/listings/${listingId}/deals`, { amountKobo: LAND.priceKobo })).body.deal.id;
    // No haggling inside the room either.
    expect((await seller.post(`/deals/${dealId}/offers`, { amountKobo: LAND.priceKobo - 100 })).status).toBe(422);
    const offer = (await seller.get(`/deals/${dealId}`)).body.offers[0].id;
    expect((await seller.post(`/deals/${dealId}/offers/${offer}/accept`)).status).toBe(200);
    // Name and remove, over and over: each one emails a stranger from our domain.
    for (let i = 0; i < 10; i++) {
      const w = await buyer.post(`/deals/${dealId}/witnesses`, {
        fullName: `Witness ${i}`,
        email: `w${i}@test.example`,
      });
      expect(w.status).toBe(201);
      const { rows } = await system().query(
        "select id from deal_witnesses where deal_id = $1 and removed_at is null and side = 'buyer'",
        [dealId],
      );
      expect((await buyer.delete(`/deals/${dealId}/witnesses/${rows[0].id}`)).status).toBe(200);
    }
    const eleventh = await buyer.post(`/deals/${dealId}/witnesses`, {
      fullName: "One More",
      email: "more@test.example",
    });
    expect(eleventh.status).toBe(429);
    // The seller's side is counted on its own.
    expect(
      (await seller.post(`/deals/${dealId}/witnesses`, { fullName: "Seller Witness", email: "sw@test.example" }))
        .status,
    ).toBe(201);
  });

  it("ends every reset link for an account once one is used", async () => {
    const user = await signUp(app, "Obinna Okeke");
    const { rows } = await system().query("select email from users where id = $1", [user.userId]);
    await user.post("/auth/forgot-password", { email: rows[0].email });
    await user.post("/auth/forgot-password", { email: rows[0].email });
    const links = await system().query(
      "select payload->>'token' as token from outbox where kind = 'password.reset' order by id desc limit 2",
    );
    const [newer, older] = links.rows.map((r) => r.token as string);
    expect((await user.post("/auth/reset-password", { token: newer, password: "a brand new password" })).status).toBe(
      200,
    );
    expect((await user.post("/auth/reset-password", { token: older, password: "an attacker's password" })).status).toBe(
      410,
    );
  });
});
