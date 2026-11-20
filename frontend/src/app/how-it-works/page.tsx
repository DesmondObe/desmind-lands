import type { Metadata } from "next";
import { PlotArt } from "@/components/plot-art";
import { ButtonLink, Eyebrow } from "@/components/ui";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How land is sold on DesMind Lands: offer, checks, a signed and witnessed agreement, direct payment, handover.",
};

const SELLERS = [
  ["List the land", "Where it is, its size, the title you hold, photos and your papers. Free."],
  ["We review it", "Our staff check the listing and its papers before it goes live."],
  ["Answer offers", "Accept, decline or counter. Talk to buyers in each deal's own room."],
  ["Give your account", "The bank account in your own name that the buyer pays into."],
  ["Sign, with a witness", "Sign the Contract of Sale; someone you trust witnesses your signature."],
  ["Confirm each payment", "Check your account and confirm each payment the buyer records."],
  ["Hand over", "Give possession and the original papers. The land is sold."],
];

const BUYERS = [
  ["Find land", "Search by state, town, price, title and use."],
  ["Make an offer", "Your offer opens a private deal room. The exact address and papers open to you."],
  ["Do your checks", "Visit the land, search the title, have a surveyor chart it, ask the community."],
  ["Prepare the agreement", "When you are satisfied, the Contract of Sale is written out with your terms."],
  ["Sign, with a witness", "You and your witness sign; so do the seller and theirs."],
  ["Pay the seller directly", "Into the account in the agreement only. Record each payment with its receipt."],
  ["Receive the land", "Confirm you have possession and the papers. Then perfect your title."],
];

const CHECKS = [
  ["Visit the land", "In daylight, with the seller. Find every beacon. Ask the neighbours who owns it."],
  ["Search the title", "At the state Lands Registry: is the title genuine, and is the seller the owner on record?"],
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
            <Eyebrow light>How it works</Eyebrow>
            <h1 className="mt-6 font-display text-5xl leading-[1.02] font-light sm:text-7xl">
              A land sale needs a seller, a buyer, <span className="text-brass-300 italic">and witnesses.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/70">
              Not an agent taking 5–10% from each side. Here is how a sale goes from offer to handover.
            </p>
          </div>
          <div className="hidden overflow-hidden rounded-[2rem] ring-1 ring-white/15 lg:block">
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

        <section id="witnesses" className="scroll-mt-28 rounded-[2.5rem] border border-line bg-surface p-8 sm:p-14">
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
                We review listings, but we do not guarantee title. These checks are what keep a buyer safe from land
                sold twice, or land under government acquisition. The deal room keeps a checklist of them.
              </p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {CHECKS.map(([t, b]) => (
                <li key={t} className="rounded-3xl border border-line bg-surface p-6">
                  <p className="font-display text-xl text-ink">{t}</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{b}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="deep-ground rounded-[2.5rem] p-10 text-white sm:p-14">
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
