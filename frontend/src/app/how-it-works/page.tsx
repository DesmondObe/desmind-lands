import type { Metadata } from "next";
import { PlotArt } from "@/components/plot-art";
import { ButtonLink, Eyebrow, Icon, icons, TitleSearchSeal } from "@/components/ui";

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

export default function HowItWorks() {
  return (
    <>
      <section className="deep-ground relative overflow-hidden text-white">
        <div className="survey-grid absolute inset-0 [--grid-line:oklch(1_0_0/0.04)]" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pt-36 pb-20 sm:px-6 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <Eyebrow light>How it works · Enugu State</Eyebrow>
            <h1 className="mt-6 font-display text-5xl leading-[1.02] font-light sm:text-7xl">
              A land sale needs a seller, a buyer, <span className="text-brass-300 italic">and witnesses.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/70">
              Not an agent taking 5–10% from each side. Here is how a sale goes from offer to handover.
            </p>
          </div>
          <div className="hidden overflow-hidden rounded-4xl ring-1 ring-white/15 lg:block">
            <div className="aspect-[4/3]">
              <PlotArt seed="how-it-works-plan" landUse="agricultural" animate />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-16 py-24 lg:grid-cols-2">
          {(
            [
              ["sellers", "For sellers", SELLERS],
              ["buyers", "For buyers", BUYERS],
            ] as const
          ).map(([id, title, steps]) => (
            <section key={id} id={id} className="scroll-mt-28">
              <Eyebrow>{title}</Eyebrow>
              <ol className="mt-8 space-y-6">
                {steps.map(([t, b], i) => (
                  <li key={t} className="flex gap-5">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full border border-line-strong font-mono text-sm text-earth-600">
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="font-display text-xl text-ink">{t}</h3>
                      <p className="mt-1 leading-relaxed text-ink-soft">{b}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>

        <section
          id="title-search"
          className="mb-10 grid scroll-mt-28 gap-10 overflow-hidden rounded-4xl border border-forest-200 bg-forest-50/70 p-8 sm:p-14 lg:grid-cols-[1.3fr_1fr] lg:items-center dark:border-forest-300"
        >
          <div>
            <Eyebrow>Our title search</Eyebrow>
            <h2 className="mt-4 max-w-2xl font-display text-4xl leading-tight text-ink">
              Every title is searched at the Enugu State Ministry of Lands before it is listed.
            </h2>
            <p className="mt-5 max-w-xl leading-relaxed text-ink-soft">
              When a seller sends land for review, our staff take its title to the Ministry of Lands. We confirm the
              document is genuine, that it is in the seller&apos;s name, and that nothing on record stands against it.
              Only then does the land go on the market, marked with the date of the search.
            </p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                "The document is genuine",
                "The seller is the owner on record",
                "No encumbrance recorded",
                "No government acquisition recorded",
              ].map((t) => (
                <li key={t} className="flex items-center gap-3 text-[15px] text-ink">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-forest-600 text-white">
                    <Icon d={icons.check} className="size-3.5" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-line bg-surface p-7 shadow-card">
            <TitleSearchSeal />
            <p className="mt-5 text-sm leading-relaxed text-ink-soft">
              Change the title, its reference or where the land is, and the search lapses: the listing goes back to us
              for a new one.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-ink-faint">
              A search reports what the Ministry&apos;s records showed on the day. It is not a guarantee of title, so a
              buyer still visits the land and takes their own legal advice.
            </p>
          </div>
        </section>

        <section id="witnesses" className="scroll-mt-28 rounded-4xl border border-line bg-surface p-8 sm:p-14">
          <Eyebrow>Witnesses</Eyebrow>
          <h2 className="mt-4 max-w-3xl font-display text-4xl leading-tight text-ink">
            Every signature on the agreement is witnessed.
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
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
              <div key={t}>
                <p className="font-display text-2xl text-earth-600">{t}</p>
                <p className="mt-2 leading-relaxed text-ink-soft">{b}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="checks" className="scroll-mt-28 py-24">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.5fr]">
            <div>
              <Eyebrow>Before you pay</Eyebrow>
              <h2 className="mt-4 font-display text-4xl leading-tight text-ink">The checks that protect a buyer</h2>
              <p className="mt-4 leading-relaxed text-ink-soft">
                Our title search is the first check, not the last. These are what keep a buyer safe from land sold
                twice, or land under government acquisition. The deal room keeps a checklist of them.
              </p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {CHECKS.map(([t, b], i) => (
                <li key={t} className="rounded-3xl border border-line bg-surface p-6 shadow-card">
                  <p className="font-mono text-xs text-earth-600">0{i + 1}</p>
                  <p className="mt-2 font-display text-xl text-ink">{t}</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{b}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="deep-ground rounded-4xl p-10 text-white sm:p-14">
          <h2 className="font-display text-4xl">Money goes straight to the seller.</h2>
          <p className="mt-4 max-w-2xl text-white/70">
            DesMind Lands never holds your money. The buyer pays only into the account written in the signed agreement,
            in the seller's own name. If anyone asks you to pay into a different account, even claiming to be us, stop
            and write in the deal room first.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/lands" variant="light" size="lg">
              Find land
            </ButtonLink>
            <ButtonLink href="/sell" size="lg" className="bg-white/10 ring-1 ring-white/25 hover:bg-white/20">
              List your land
            </ButtonLink>
          </div>
        </section>
      </div>
    </>
  );
}
