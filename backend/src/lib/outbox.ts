import { sql } from "drizzle-orm";
import type { Tx } from "../db/client.ts";

export type OutboxEvent =
  | { kind: "password.reset"; payload: { userId: string; token: string } }
  | { kind: "welcome"; payload: { userId: string } }
  | { kind: "listing.reviewed"; payload: { listingId: string } }
  | { kind: "deal.opened"; payload: { dealId: string } }
  | { kind: "offer.made"; payload: { offerId: string } }
  | { kind: "offer.answered"; payload: { offerId: string } }
  | { kind: "deal.message"; payload: { messageId: string } }
  | { kind: "deal.stage"; payload: { dealId: string; stage: string } }
  | { kind: "deal.cancelled"; payload: { dealId: string } }
  // The token travels so the worker can put the link in the email; it is stripped once sent.
  | { kind: "witness.invited"; payload: { witnessId: string; token: string } }
  | { kind: "payment.declared"; payload: { paymentId: string } }
  | { kind: "payment.answered"; payload: { paymentId: string } };

/** Queues work for the worker, inside the caller's transaction. */
export async function enqueue(tx: Tx, event: OutboxEvent) {
  await tx.execute(
    sql`insert into outbox (kind, payload) values (${event.kind}, ${JSON.stringify(event.payload)}::jsonb)`,
  );
}
