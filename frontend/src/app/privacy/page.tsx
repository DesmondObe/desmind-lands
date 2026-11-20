import type { Metadata } from "next";
import { Prose } from "@/components/prose";
import { contact } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <Prose eyebrow="Privacy" title="Privacy notice" updated="20 November 2026">
      <p>
        {contact.company} keeps the least it needs to run DesMind Lands, in line with the Nigeria Data Protection Act
        2023.
      </p>
      <h2>What we keep</h2>
      <p>
        Your name, email and phone; the land you list, its photos and papers; and, in each deal, the offers, messages,
        signatures, payments and receipts. For witnesses: their name, contact, address and occupation, and when they
        signed.
      </p>
      <h2>Who sees it</h2>
      <p>
        The public sees a listing's town, photos, price and the seller's name, never their email or phone. The exact
        address, title number and papers open to a buyer once they make an offer. Your contact details are shared only
        with the other party in a deal you are both in. Our staff see what they need to review listings and resolve
        disputes.
      </p>
      <h2>Why</h2>
      <p>To let you buy and sell land, and to keep a reliable record of each sale for both sides.</p>
      <h2>How long</h2>
      <p>
        Records of completed sales are kept for as long as they may be needed as evidence: at least twelve years. You
        may ask us for a copy of your data, or to correct it, at <a href={`mailto:${contact.email}`}>{contact.email}</a>
        .
      </p>
    </Prose>
  );
}
