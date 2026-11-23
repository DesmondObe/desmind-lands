import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PhotoGround } from "@/components/photo";
import { Icon, icons } from "@/components/ui";

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
  [icons.pin, "Visit the land", "In daylight, with the seller. Find every beacon. Ask the neighbours who owns it."],
  [
    icons.shield,
    "Read our title search",
    "We searched it at the Enugu State Ministry of Lands before listing. The reference and findings are in your deal room.",
  ],
  [icons.users, "Meet the owner", "In person, with ID that matches the name on the title and on our search."],
  [
    icons.ruler,
    "Chart the survey plan",
    "A surveyor checks with the Surveyor-General that the land is not under government acquisition.",
  ],
  [
    icons.chat,
    "Ask the community",
    "For family or community land, confirm the family head and principal members consent.",
  ],
  [
    icons.doc,
    "Use a lawyer",
    "A lawyer of your own choosing can read the papers, and prepare the Deed of Assignment after.",
  ],
];

const SEARCHED = [
  "The document is genuine",
  "The seller is the owner on record",
  "No encumbrance recorded",
  "No government acquisition recorded",
];

const WITNESSES = [
  ["Who", "Each side names at least one adult who knows them: family, a friend, a lawyer. Never the other party."],
  [
    "How",
    "We email them a private link, or you send it on WhatsApp. They read the agreement and sign. No account needed.",
  ],
  [
    "Why",
    "A witness attests that the person signing is who they say, signing freely. It is the safeguard agents never gave.",
  ],
];

const COLUMN = "mx-auto w-full max-w-5xl px-5 sm:px-8";
const H2 = "font-display text-[2rem] leading-[1.1] tracking-[-0.02em] text-ink sm:text-[2.5rem]";
const BODY = "text-[15px] leading-relaxed text-ink-soft";
const SECTION = `${COLUMN} scroll-mt-24 pt-20 sm:pt-28`;

function Heading({ children }: { children: ReactNode }) {
  return (
    <div>
      <h2 className={H2}>{children}</h2>
      <span className="mt-5 block h-0.5 w-12 bg-ink" aria-hidden="true" />
    </div>
  );
}

function ArrowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2.5 border border-ink px-5 py-2.5 text-[15px] font-semibold text-ink transition hover:bg-ink hover:text-canvas"
    >
      {children}
      <Icon d={icons.arrow} className="size-4" />
    </Link>
  );
}

export default function HowItWorks() {
  return (
    <>
      <section className="relative flex min-h-[70vh] flex-col overflow-hidden bg-black text-white">
        <PhotoGround name="enugu-homes" eager />
        <div className="relative mx-auto flex w-full max-w-3xl flex-1 animate-rise flex-col items-center justify-center px-5 pt-28 pb-24 text-center">
          <h1 className="hero-serif text-[2.5rem] leading-[1.05] tracking-[-0.025em] sm:text-[3.4rem]">
            A seller. A buyer. <span className="italic">And witnesses.</span>
          </h1>
          <p className="mt-4 text-lg text-white sm:text-xl">No agent. No commission. Offer to handover.</p>
        </div>
        <a
          href="#sellers"
          className="absolute inset-x-0 bottom-16 mx-auto flex w-fit flex-col items-center gap-2 text-xs text-white"
        >
          Scroll down
          <span className="flex h-9 w-5 justify-center rounded-full border border-white pt-1.5" aria-hidden="true">
            <span className="h-2 w-0.5 animate-bounce rounded-full bg-white" />
          </span>
        </a>
      </section>

      <div className="relative -mt-10 -mb-24 rounded-t-[2.5rem] bg-canvas sm:rounded-t-[3.5rem]">
        <div className={`${COLUMN} grid gap-x-16 lg:grid-cols-2`}>
          {(
            [
              ["sellers", "Selling", SELLERS],
              ["buyers", "Buying", BUYERS],
            ] as const
          ).map(([id, title, steps]) => (
            <section key={id} id={id} className="scroll-mt-24 pt-20 sm:pt-28">
              <Heading>{title}</Heading>
              <ol className="mt-8">
                {steps.map(([t, b], i) => (
                  <li key={t} className="flex gap-5 border-t border-line py-4">
                    <span className="w-7 shrink-0 text-[13px] font-bold tracking-[0.1em] text-ink-faint">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3 className="text-[17px] font-semibold text-ink">{t}</h3>
                      <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{b}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>

        <section id="title-search" className="scroll-mt-24 pt-20 sm:pt-28">
          <h2 className={`${COLUMN} text-center ${H2}`}>Every title, searched first</h2>
          <div className="relative mx-3 mt-10 overflow-hidden bg-black text-white sm:mx-6">
            <PhotoGround name="nsukka-town" />
            <div className={`${COLUMN} relative flex min-h-[30rem] flex-col justify-end py-12`}>
              <p className="w-fit max-w-xs bg-white px-5 py-4 text-2xl leading-tight font-semibold tracking-tight text-black">
                Searched at the Ministry of Lands
              </p>
              <p className="mt-3 w-fit bg-black px-4 py-2.5 text-[13px] font-semibold text-white">
                Before anything is listed
              </p>
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white">
                When a seller sends land for review, our staff take its title to the Enugu State Ministry of Lands. Only
                then does the land go on the market, marked with the date of the search.
              </p>
            </div>
          </div>
          <div className={`${COLUMN} mt-10 grid gap-10 lg:grid-cols-2 lg:gap-16`}>
            <ul>
              {SEARCHED.map((t, i) => (
                <li key={t} className="flex items-baseline gap-5 border-t border-line py-3.5 text-[15px] text-ink">
                  <span className="text-[13px] font-bold tracking-[0.1em] text-ink-faint">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <p className="text-[14px] leading-relaxed text-ink-soft">
              Change the title, its reference or where the land is, and the search lapses: the listing comes back to us
              for a new one. A search reports what the Ministry&apos;s records showed on the day. It is not a guarantee
              of title, so a buyer still visits the land and takes their own legal advice.
            </p>
          </div>
        </section>

        <section id="witnesses" className={SECTION}>
          <Heading>Every signature, witnessed</Heading>
          <ol className="mt-12 grid gap-5 sm:grid-cols-3 sm:pb-10">
            {WITNESSES.map(([t, b], i) => {
              const dark = i === 1;
              return (
                <li
                  key={t}
                  className={`flex min-h-60 flex-col rounded-2xl p-6 ${dark ? "bg-ink text-canvas sm:translate-y-10" : "bg-sunken text-ink"}`}
                >
                  <h3 className="text-lg font-semibold tracking-tight">{t}</h3>
                  <p className={`mt-3 text-[14px] leading-relaxed ${dark ? "text-canvas" : "text-ink-soft"}`}>{b}</p>
                  <span className={`mt-auto pt-8 text-4xl font-semibold ${dark ? "text-canvas" : "text-ink-faint"}`}>
                    #{i + 1}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <section id="checks" className={SECTION}>
          <h2 className={`text-center ${H2}`}>Six checks. Then pay.</h2>
          <p className={`mx-auto mt-4 max-w-md text-center ${BODY}`}>
            Our title search is the first check, not the last. The deal room keeps the list.
          </p>
          <ol className="mt-12 grid gap-x-8 gap-y-10 text-center sm:grid-cols-2 lg:grid-cols-3">
            {CHECKS.map(([icon, t, b], i) => (
              <li key={t} className="border-t border-ink pt-5">
                <p className="text-[13px] font-bold tracking-[0.2em] text-ink-faint">STEP 0{i + 1}</p>
                <span
                  className="mx-auto mt-5 grid size-16 place-items-center rounded-full bg-ink text-canvas"
                  aria-hidden="true"
                >
                  <Icon d={icon} className="size-7" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-ink">{t}</h3>
                <p className="mx-auto mt-2 max-w-[17rem] text-[13px] leading-relaxed text-ink-soft">{b}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={SECTION}>
          <div className="relative overflow-hidden bg-black px-6 py-12 text-white sm:px-12 sm:py-16">
            <PhotoGround name="enugu-road" />
            <div className="relative">
              <h2 className="font-display text-[2rem] leading-[1.1] tracking-[-0.02em] sm:text-[2.5rem]">
                Money goes <span className="italic">straight to the seller.</span>
              </h2>
              <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-white">
                We never hold it. Pay only into the account in the signed agreement. If anyone names another account,
                even claiming to be us, stop and write in the deal room first.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-20 bg-sunken py-16 text-center sm:mt-28">
          <h2 className="px-5 text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">Ready to begin?</h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3 px-5">
            <ArrowLink href="/lands">Find land</ArrowLink>
            <ArrowLink href="/sell">List your land</ArrowLink>
          </div>
        </section>
      </div>
    </>
  );
}
