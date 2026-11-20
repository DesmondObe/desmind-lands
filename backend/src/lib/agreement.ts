import { formatDay, formatKobo, nairaInWords } from "./format.ts";
import { sha256 } from "./tokens.ts";

export const TITLE_LABEL: Record<string, string> = {
  c_of_o: "Certificate of Occupancy (C of O)",
  governors_consent: "Governor's Consent",
  deed_of_assignment: "Registered Deed of Assignment",
  registered_survey: "Registered Survey Plan",
  gazette: "Gazette",
  excision: "Excision",
  customary_right: "Customary Right of Occupancy",
  family_receipt: "Family / Community Receipt and Agreement",
  other: "Other document of title",
};

export const SIZE_LABEL: Record<string, [string, string]> = {
  plot: ["plot", "plots"],
  sqm: ["square metre", "square metres"],
  acre: ["acre", "acres"],
  hectare: ["hectare", "hectares"],
};

export const formatSize = (value: number, unit: string) => {
  const [one, many] = SIZE_LABEL[unit] ?? [unit, unit];
  return `${Number(value).toLocaleString("en-NG", { maximumFractionDigits: 2 })} ${Number(value) === 1 ? one : many}`;
};

/** The buyer's own checks before anything is signed, with what each one means. */
export const CHECKS = [
  { key: "visited", label: "I have visited the land in person and seen its beacons." },
  { key: "registry_search", label: "I have searched the title at the state Lands Registry." },
  { key: "survey_charting", label: "A surveyor has charted the survey plan (not under government acquisition)." },
  { key: "community", label: "I have confirmed with the community or family that the seller owns it." },
  { key: "lawyer", label: "A lawyer of my choosing has reviewed the documents." },
] as const;

/** "Enugu State", but "the Federal Capital Territory, Abuja". */
const stateName = (s: string) => (/FCT|Abuja/i.test(s) ? "the Federal Capital Territory, Abuja" : `${s} State`);

export type AgreementFacts = {
  dealId: string;
  seller: { fullName: string; email: string; phone: string };
  buyer: { fullName: string; email: string; phone: string };
  listing: {
    title: string;
    addressLine: string;
    town: string;
    lga: string;
    state: string;
    sizeValue: number;
    sizeUnit: string;
    landUse: string;
    titleKind: string;
    titleReference: string;
    latitude: number | null;
    longitude: number | null;
  };
  agreedKobo: number;
  completionDate: string | null;
  bank: { name: string; accountNumber: string; accountName: string };
  specialTerms: string;
  preparedOn: string;
};

/**
 * The Contract of Sale, written out in full from the deal. It is fixed (and hashed) when the
 * buyer asks for it to be prepared; every signature is over this exact text, so a change to
 * any term means a new text and new signatures.
 */
export function agreementText(f: AgreementFacts): string {
  const l = f.listing;
  const where = [l.addressLine, l.town, l.lga && `${l.lga} Local Government Area`, stateName(l.state)]
    .filter(Boolean)
    .join(", ");
  const coords =
    l.latitude != null && l.longitude != null ? ` The land lies at about ${l.latitude}, ${l.longitude}.` : "";
  const reference = l.titleReference ? ` (reference: ${l.titleReference})` : "";
  const price = `${formatKobo(f.agreedKobo)} (${nairaInWords(f.agreedKobo)})`;
  const completion = f.completionDate
    ? `on or before ${formatDay(f.completionDate)}`
    : "within a reasonable time agreed by the Parties";

  const clauses = [
    `CONTRACT OF SALE OF LAND`,
    `Deal reference: ${f.dealId}\nPrepared on DesMind Lands on ${formatDay(f.preparedOn)}.`,
    `THIS AGREEMENT is made between:`,
    `1. ${f.seller.fullName}, reachable at ${f.seller.email}${f.seller.phone ? ` and +${f.seller.phone}` : ""} (the "Vendor"); and`,
    `2. ${f.buyer.fullName}, reachable at ${f.buyer.email}${f.buyer.phone ? ` and +${f.buyer.phone}` : ""} (the "Purchaser"),`,
    `together the "Parties".`,
    `1. THE PROPERTY\nThe Vendor agrees to sell, and the Purchaser agrees to buy, all that parcel of land measuring about ${formatSize(l.sizeValue, l.sizeUnit)}, for ${l.landUse} use, situate at ${where} (the "Property"), as described on DesMind Lands under the title "${l.title}".${coords}`,
    `2. PRICE\nThe price of the Property is ${price} (the "Price"). No agent, broker or middleman is party to this sale, and no commission, agency or "agreement" fee is payable by either Party to anyone in respect of it.`,
    `3. PAYMENT\nThe Purchaser shall pay the Price directly to the Vendor, into the account below, and not to any other person:\n    Bank: ${f.bank.name}\n    Account number: ${f.bank.accountNumber}\n    Account name: ${f.bank.accountName}\nEach payment shall be recorded on DesMind Lands with its receipt, and confirmed there by the Vendor. The Vendor's confirmation of a payment is his or her acknowledgment of receiving it.`,
    `4. THE VENDOR'S PROMISES\nThe Vendor declares that he or she is the owner of the Property, holding it under a ${TITLE_LABEL[l.titleKind] ?? "document of title"}${reference}; that he or she has the right to sell it; that it is free from any charge, mortgage, lien, government acquisition, court case or other claim known to the Vendor; and that it has not been sold, promised or pledged to anyone else. If any of these declarations is untrue, the Purchaser may end this agreement and the Vendor shall refund every sum paid under it within thirty (30) days.`,
    `5. THE PURCHASER'S CHECKS\nThe Purchaser confirms that he or she has had the opportunity to inspect the Property and its documents, to search the title at the Lands Registry and to take independent legal and survey advice, and enters this agreement on the strength of his or her own checks.`,
    `6. COMPLETION AND POSSESSION\nUpon payment of the Price in full, ${completion}, the Vendor shall give the Purchaser vacant possession of the Property and hand over the original documents of title, the survey plan and every receipt relating to the Property, and shall execute a Deed of Assignment in favour of the Purchaser (or the Purchaser's nominee).`,
    `7. PERFECTION OF TITLE\nThe Purchaser is responsible for perfecting title, including obtaining the Governor's Consent and registering the Deed of Assignment where the law requires it. The Vendor shall sign any document and give any reasonable help that perfection requires, without further payment.`,
    `8. DEFAULT\nIf the Purchaser does not pay the Price in full by the completion date, the Vendor may, after giving fourteen (14) days' written notice, end this agreement and refund the sums received, less any loss the Vendor can show. If the Vendor fails to complete, the Purchaser may insist on completion or end this agreement and recover every sum paid.`,
    ...(f.specialTerms.trim() ? [`9. SPECIAL TERMS AGREED BY THE PARTIES\n${f.specialTerms.trim()}`] : []),
    `${f.specialTerms.trim() ? "10" : "9"}. LAW\nThis agreement is governed by the laws of the Federal Republic of Nigeria and of ${stateName(l.state)}, where the Property is situate. The Parties shall first try in good faith to settle any dispute between themselves, then by mediation, before going to court.`,
    `${f.specialTerms.trim() ? "11" : "10"}. SIGNATURES AND WITNESSES\nEach Party signs this agreement electronically on DesMind Lands, by typing his or her full name, which is his or her signature under section 93 of the Evidence Act 2011 and section 17 of the Cybercrimes (Prohibition, Prevention, etc.) Act 2015. Each Party's signature is attested by at least one witness of his or her choosing, who also signs electronically. The record of who signed, and when, is kept with this agreement.`,
    `DesMind Lands provides the platform on which the Parties deal directly with each other. It is not a party to this agreement, is not the agent of either Party, does not hold any money, and does not guarantee the title to the Property.`,
  ];
  return clauses.join("\n\n");
}

export const hashAgreement = (text: string) => sha256(text);
