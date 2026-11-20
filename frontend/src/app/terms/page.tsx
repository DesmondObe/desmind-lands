import type { Metadata } from "next";
import { Prose } from "@/components/prose";
import { contact } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of use" };

export default function Terms() {
  return (
    <Prose eyebrow="Terms" title="Terms of use" updated="20 November 2026">
      <p>
        DesMind Lands is operated by {contact.company}. It is a technology platform on which owners of land and people
        who want to buy it deal directly with each other. By using it you agree to these terms.
      </p>
      <h2>What we are, and what we are not</h2>
      <p>
        We are <strong>not an estate agent</strong>, broker or party to any sale. We do not hold money or act for either
        side. For now, DesMind Lands lists land in Enugu State only.
      </p>
      <h2>Our title search</h2>
      <p>
        Before a listing is published, our staff search its title at the Enugu State Ministry of Lands and record the
        search reference and what it showed. A search reports what the Ministry&apos;s records showed on the day it was
        made. It is not a guarantee of the title to, or the condition of, any land, and records can be wrong or change.
        Buyers must still make their own checks, and we strongly recommend independent legal and survey advice.
      </p>
      <h2>Sellers</h2>
      <p>
        You may list only land you own and have the right to sell. Everything you say about it must be true. Listing
        land you do not own, or land already sold or pledged, is fraud, and we will report it to the police.
      </p>
      <h2>Buyers</h2>
      <p>
        Pay only into the account written in the signed agreement, in the seller's own name. Record each payment, with
        its receipt, in the deal room. Never pay because someone asks you to by phone, email or text, even in our name.
      </p>
      <h2>Agreements and signatures</h2>
      <p>
        The agreement in a deal room is made between the seller and the buyer alone. Typing your name to sign it is your
        electronic signature. The agreement is not a registered Deed of Assignment: perfecting title at the Lands
        Registry is the buyer's responsibility.
      </p>
      <h2>Witnesses</h2>
      <p>
        A witness confirms only that the person whose signature they witness is who they claim to be and signs freely. A
        witness takes on no liability for the sale.
      </p>
      <h2>Fees</h2>
      <p>Listing, offers and deal rooms are free. We take no commission from either side.</p>
      <h2>Contact</h2>
      <p>
        <a href={`mailto:${contact.email}`}>{contact.email}</a> · {contact.phone} · {contact.office}
      </p>
    </Prose>
  );
}
