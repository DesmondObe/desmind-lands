import type { Metadata } from "next";
import { PhotoGround } from "@/components/photo";
import { ButtonLink, Eyebrow } from "@/components/ui";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How land is sold in Enugu State on DesMind Lands: a title search at the Ministry of Lands, offer, checks, a signed and witnessed agreement, direct payment, handover.",
};

const SELLERS = [
  ["List the land", "Where it is, its size, the title you hold, photos and your papers. Free."],
  ["We search your title", "Our staff search it at the Enugu State Ministry of Lands, then publish the listing."],
  ["Answer offers", "Accept, decline or counter. Talk to buyers in each deal's own room."],
  ["Give your account", "The bank account in your own name that the buyer pays into."],
  ["Sign, with a witness", "Sign the Contract of Sale; someone you trust witnesses your signature."],
  ["Confirm each payment", "Check your account and confirm each payment the buyer records."],
  ["Hand over", "Give possession and the original papers. The land is sold."],
];

const BUYERS = [
  ["Find land", "Search by area of Enugu, price, title and use. Every title already searched."],
  ["Make an offer", "Your offer opens a private deal room. The exact address and papers open to you."],
  ["Do your checks", "Visit the land, read our title search, have a surveyor chart it, ask the community."],
  ["Prepare the agreement", "When you are satisfied, the Contract of Sale is written out with your terms."],
  ["Sign, with a witness", "You and your witness sign; so do the seller and theirs."],
  ["Pay the seller directly", "Into the account in the agreement only. Record each payment with its receipt."],
  ["Receive the land", "Confirm you have possession and the papers. Then perfect your title."],
];

const CHECKS = [
  ["Visit the land", "In daylight, with the seller. Find every beacon. Ask the neighbours who owns it."],
  [
    "Read our title search",
    "We searched it at the Enugu State Ministry of Lands before listing. The reference and findings are in your deal room.",
  ],
  ["Meet the owner", "In person, with ID that matches the name on the title and on our search."],
  [
    "Chart the survey plan",
    "A surveyor checks with the Surveyor-General that the land is not under government acquisition.",
  ],
  ["Ask the community", "For family or community land, confirm the family head and principal members consent."],
  ["Use a lawyer", "A lawyer of your own choosing can read the papers, and prepare the Deed of Assignment after."],
];

const H2 = "font-display text-5xl leading-[0.98] tracking-[-0.025em] text-ink sm:text-7xl";

export default function HowItWorks() {
  return (
    <>
      <section className="relative flex min-h-[80vh] flex-col overflow-hidden bg-black text-white">
        <PhotoGround name="enugu-homes" eager />
        <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col justify-end px-4 pt-40 pb-14 sm:px-6 sm:pb-20">
          <Eyebrow light>How it works · Enugu State</Eyebrow>
          <h1 className="mt-6 max-w-5xl font-display text-5xl leading-[0.95] tracking-[-0.03em] sm:text-8xl">
            A seller. A buyer. <span className="text-white/65 italic">And witnesses.</span>
          </h1>
          <p className="mt-8 text-xl text-white/85">No agent. No commission. Offer to handover.</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-x-20 gap-y-24 pt-24 sm:pt-32 lg:grid-cols-2">
          {(
            [
              ["sellers", "For sellers", "Selling.", SELLERS],
              ["buyers", "For buyers", "Buying.", BUYERS],
            ] as const
          ).map(([id, eyebrow, title, steps]) => (
            <section key={id} id={id} className="scroll-mt-28">
              <Eyebrow>{eyebrow}</Eyebrow>
              <h2 className={`mt-5 ${H2}`}>{title}</h2>
              <ol className="mt-10 border-b border-line">
                {steps.map(([t, b], i) => (
                  <li key={t} className="flex gap-6 border-t border-line py-5">
                    <span className="w-6 shrink-0 pt-1.5 font-mono text-xs text-ink-faint">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3 className="font-display text-2xl text-ink">{t}</h3>
                      <p className="mt-1 leading-relaxed text-ink-soft">{b}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>

        <section id="title-search" className="scroll-mt-28 pt-24 sm:pt-32">
          <Eyebrow>Our title search</Eyebrow>
          <h2 className={`mt-5 max-w-4xl ${H2}`}>
            Every title. <span className="text-ink-faint italic">Searched first.</span>
          </h2>
          <div className="mt-12 grid gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <p className="text-lg leading-relaxed text-ink-soft">
                When a seller sends land for review, our staff take its title to the Enugu State Ministry of Lands. Only
                then does the land go on the market, marked with the date of the search.
              </p>
              <p className="mt-6 text-sm leading-relaxed text-ink-faint">
                Change the title, its reference or where the land is, and the search lapses: the listing comes back to
                us for a new one. A search reports what the Ministry&apos;s records showed on the day. It is not a
                guarantee of title, so a buyer still visits the land and takes their own legal advice.
              </p>
            </div>
            <ul className="self-start border-b border-line">
              {[
                "The document is genuine",
                "The seller is the owner on record",
                "No encumbrance recorded",
                "No government acquisition recorded",
              ].map((t, i) => (
                <li key={t} className="flex items-baseline gap-6 border-t border-line py-4 text-lg text-ink">
                  <span className="font-mono text-xs text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="witnesses" className="scroll-mt-28 pt-24 sm:pt-32">
          <Eyebrow>Witnesses</Eyebrow>
          <h2 className={`mt-5 max-w-4xl ${H2}`}>
            Every signature, <span className="text-ink-faint italic">witnessed.</span>
          </h2>
          <div className="mt-14 grid gap-x-8 gap-y-10 md:grid-cols-3">
            {[
              [
                "Who",
                "Each side names at least one adult who knows them: family, a friend, a lawyer. Never the other party.",
              ],
              [
                "How",
                "We email them a private link, or you send it on WhatsApp. They read the agreement and sign. No account needed.",
              ],
              [
                "Why",
                "A witness attests that the person signing is who they say, signing freely. It is the safeguard agents never gave.",
              ],
            ].map(([t, b]) => (
              <div key={t} className="border-t border-ink pt-5">
                <p className="font-display text-2xl text-ink">{t}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{b}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="checks" className="scroll-mt-28 pt-24 sm:pt-32">
          <Eyebrow>Before you pay</Eyebrow>
          <h2 className={`mt-5 max-w-4xl ${H2}`}>
            Six checks. <span className="text-ink-faint italic">Then pay.</span>
          </h2>
          <p className="mt-6 max-w-xl text-lg text-ink-soft">
            Our title search is the first check, not the last. The deal room keeps the list.
          </p>
          <ol className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {CHECKS.map(([t, b], i) => (
              <li key={t} className="border-t border-ink pt-5">
                <p className="font-mono text-xs text-ink-faint">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-8 font-display text-2xl text-ink">{t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{b}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="relative mt-24 -mb-24 overflow-hidden bg-black text-white sm:mt-32">
        <PhotoGround name="enugu-road" />
        <div className="relative mx-auto flex min-h-[78vh] w-full max-w-7xl flex-col justify-end px-4 py-14 sm:px-6 sm:py-20">
          <Eyebrow light>Payment</Eyebrow>
          <p className="mt-6 max-w-5xl font-display text-5xl leading-[0.95] tracking-[-0.03em] sm:text-8xl">
            Money goes <span className="text-white/65 italic">straight to the seller.</span>
          </p>
          <p className="mt-6 max-w-2xl text-lg text-white/85">
            We never hold it. Pay only into the account in the signed agreement. If anyone names another account, even
            claiming to be us, stop and write in the deal room first.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/lands" variant="light" size="lg">
              Find land
            </ButtonLink>
            <ButtonLink href="/sell" size="lg" className="bg-white/10 ring-1 ring-white/25 hover:bg-white/20">
              List your land
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
