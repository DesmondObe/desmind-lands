"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { CardSkeleton, ListingCard } from "@/components/listing-card";
import { Photo, PhotoGround, type PhotoName } from "@/components/photo";
import { PlotArt } from "@/components/plot-art";
import { Button, Icon, icons } from "@/components/ui";
import { api, type ListingCard as Card } from "@/lib/api";
import { formatKobo, HOME_LGAS } from "@/lib/land";

/*
 * The home page: a photographed hero with its words in the middle, then a white sheet that rises
 * over it on rounded corners. Everything below sits in one narrow column with plenty of air:
 * small headings over a short rule, small type, and the photographs of Enugu State.
 */

const AREAS: [PhotoName, string][] = [
  ["enugu-layout", "Independence Layout"],
  ["iva-valley", "Enugu"],
  ["nsukka-homes", "Nsukka"],
  ["achi-plot", "Achi"],
  ["enugu-road", "Oji River"],
  ["ngwo-hill", "Ngwo"],
];

const STEPS: [PhotoName, string, string][] = [
  ["achi-plot", "Offer", "The buyer offers. The owner accepts, declines or counters."],
  ["ngwo-hill", "Inspect", "Visit the land. See the title and the survey plan."],
  ["nsukka-homes", "Sign", "One contract, with a witness for each side."],
  ["enugu-layout", "Pay", "Buyer to seller, straight to the owner's account."],
  ["iva-valley", "Hand over", "Papers and possession pass to the buyer."],
];

const PROMISES: [string, string, string][] = [
  ["Title searched", "At the Enugu State Ministry of Lands, before the land is listed.", icons.shield],
  ["No money held", "The buyer pays the seller's own account. We never touch it.", icons.bank],
  ["All on record", "Every offer, receipt and signature is kept for both sides.", icons.doc],
];

const REASONS: [string, string, string][] = [
  ["No agent", "Owner and buyer deal directly.", icons.users],
  ["No commission", "Nothing is taken from the price.", icons.coins],
  ["Papers first", "See the title before you pay.", icons.eye],
  ["A witness each", "Someone you trust signs with you.", icons.pen],
];

const COLUMN = "mx-auto w-full max-w-5xl px-5 sm:px-8";
const H2 = "font-display text-[2rem] leading-[1.1] tracking-[-0.02em] text-ink sm:text-[2.5rem]";
const BODY = "text-[15px] leading-relaxed text-ink-soft";

export default function Home() {
  const router = useRouter();
  const [listings, setListings] = useState<Card[] | null>(null);
  const [stats, setStats] = useState<{ live: number; sold: number; soldValueKobo: number; states: number } | null>(
    null,
  );
  const [q, setQ] = useState("");
  const [lga, setLga] = useState("");

  useEffect(() => {
    api<{ listings: Card[] }>("/listings?limit=6").then(
      (r) => setListings(r.listings),
      () => setListings([]),
    );
    api<typeof stats>("/stats").then(setStats, () => {});
  }, []);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (lga) p.set("lga", lga);
    router.push(`/lands${p.size ? `?${p}` : ""}`);
  };

  const figures: [string, string][] = [
    ["0%", "Commission"],
    ["100%", "Titles searched"],
    ["17", "LGAs covered"],
    ["5", "Steps to a sale"],
    ...(stats?.live ? ([[String(stats.live), "Plots for sale"]] as [string, string][]) : []),
  ];

  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative flex min-h-[88vh] flex-col overflow-hidden bg-black text-white">
        <PhotoGround name="enugu-city" eager />
        <div className="relative mx-auto flex w-full max-w-3xl flex-1 animate-rise flex-col items-center justify-center px-5 pt-28 pb-24 text-center">
          <h1 className="font-display text-[2.5rem] leading-[1.05] tracking-[-0.025em] sm:text-[3.4rem]">
            Sell your land. <span className="italic">Keep every naira.</span>
          </h1>
          <p className="mt-4 text-lg text-white sm:text-xl">No agents. No commission. Every title searched first.</p>

          <form
            onSubmit={search}
            className="mt-9 flex w-full max-w-xl flex-col gap-2 rounded-3xl bg-white p-2 text-left sm:flex-row sm:rounded-full"
          >
            <label className="flex flex-1 items-center gap-3 px-4 text-black">
              <Icon d={icons.search} className="size-5 text-black" />
              <span className="sr-only">Town or area</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Area, layout or estate"
                className="h-11 w-full bg-transparent text-[15px] text-black outline-none placeholder:text-neutral-500"
              />
            </label>
            <select
              value={lga}
              onChange={(e) => setLga(e.target.value)}
              aria-label="Local government area"
              className="h-11 rounded-full bg-white px-4 text-sm font-semibold text-black outline-none sm:w-40"
            >
              <option value="">All of Enugu</option>
              {HOME_LGAS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <Button type="submit" variant="earth" className="h-11">
              Find land
            </Button>
          </form>
        </div>

        <a
          href="#about"
          className="absolute inset-x-0 bottom-16 mx-auto flex w-fit flex-col items-center gap-2 text-xs text-white"
        >
          Scroll down
          <span className="flex h-9 w-5 justify-center rounded-full border border-white pt-1.5" aria-hidden="true">
            <span className="h-2 w-0.5 animate-bounce rounded-full bg-white" />
          </span>
        </a>
      </section>

      {/* The white sheet that rises over the photograph. */}
      <div className="relative -mt-10 -mb-24 rounded-t-[2.5rem] bg-canvas sm:rounded-t-[3.5rem]">
        {/* -------------------------------------------------------------- Who we are */}
        <section id="about" className={`${COLUMN} scroll-mt-24 pt-20 sm:pt-28`}>
          <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr] lg:gap-20">
            <div>
              <Badge d={icons.users} />
              <Heading className="mt-5">Owner to buyer</Heading>
              <p className={`mt-7 ${BODY}`}>
                DesMind Lands is where land in Enugu State is sold by the person who owns it. There is no agent in the
                middle and no 10% taken from either side.
              </p>
              <p className={`mt-4 ${BODY}`}>
                We search every title at the Ministry of Lands before the land is listed. Then the two sides agree a
                price, sign one contract before witnesses, and the buyer pays the seller directly.
              </p>
            </div>
            <dl className="grid grid-cols-2 content-start gap-x-10 gap-y-8 lg:pt-2">
              {figures.map(([big, small]) => (
                <div key={small}>
                  <dt className="sr-only">{small}</dt>
                  <dd className="font-display text-[2.5rem] leading-none text-ink tabular">{big}</dd>
                  <dd className="mt-2 text-[13px] text-ink-soft">{small}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* -------------------------------------------------------------- Title search */}
        <section id="title-search" className="scroll-mt-24 pt-20 sm:pt-28">
          <h2 className={`${COLUMN} text-center ${H2}`}>Every title, searched first</h2>
          <div className="relative mx-3 mt-10 overflow-hidden rounded-[2rem] bg-black text-white sm:mx-6">
            <PhotoGround name="nsukka-town" />
            <div className={`${COLUMN} relative flex min-h-[32rem] flex-col justify-end py-12`}>
              <p className="w-fit max-w-xs bg-white px-5 py-4 text-2xl leading-tight font-semibold tracking-tight text-black">
                Searched at the Ministry of Lands
              </p>
              <p className="mt-3 w-fit bg-black px-4 py-2.5 text-[13px] font-semibold text-white">
                Before anything is listed
              </p>
              <div className="mt-5 flex flex-wrap items-end justify-between gap-6">
                <p className="max-w-xl text-[15px] leading-relaxed text-white">
                  We take the owner's papers to the Enugu State Ministry of Lands and check the title against the
                  Ministry's own records. Only land that passes goes on sale.
                </p>
                <Link
                  href="/how-it-works#title-search"
                  className="rounded-full border border-white px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white hover:text-black"
                >
                  How we search
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------------- What you get */}
        <section className={`${COLUMN} pt-20 sm:pt-28`}>
          <Heading>What you get</Heading>
          <ol className="mt-12 grid gap-5 sm:grid-cols-3 sm:pb-10">
            {PROMISES.map(([title, body, icon], i) => {
              const dark = i === 1;
              return (
                <li
                  key={title}
                  className={`flex min-h-56 flex-col rounded-2xl p-6 ${dark ? "bg-ink text-canvas sm:translate-y-10" : "bg-sunken text-ink"}`}
                >
                  <h3 className="text-lg leading-tight font-semibold tracking-tight">{title}</h3>
                  <p className={`mt-3 text-[14px] leading-relaxed ${dark ? "text-canvas" : "text-ink-soft"}`}>{body}</p>
                  <div className="mt-auto flex items-end justify-between pt-8">
                    <span className={`text-4xl font-semibold tabular ${dark ? "text-canvas" : "text-ink-faint"}`}>
                      #{i + 1}
                    </span>
                    <Icon d={icon} className="size-9" />
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* -------------------------------------------------------------- Why */}
        <section className={`${COLUMN} pt-20 sm:pt-28`}>
          <div className="relative overflow-hidden rounded-[2rem] bg-black px-6 py-12 text-white sm:px-12 sm:py-16">
            <PhotoGround name="nsukka-sky" />
            <div className="relative">
              <h2 className="font-display text-[2rem] leading-[1.1] tracking-[-0.02em] sm:text-[2.5rem]">
                Agents take 10%. <span className="italic">We take nothing.</span>
              </h2>
              <ul className="mt-14 grid grid-cols-2 gap-x-6 gap-y-10 text-center lg:grid-cols-4">
                {REASONS.map(([title, body, icon]) => (
                  <li key={title}>
                    <Icon d={icon} className="mx-auto size-10" />
                    <h3 className="mt-4 text-lg leading-tight font-semibold">{title}</h3>
                    <p className="mx-auto mt-2 max-w-[11rem] text-[13px] leading-snug text-white">{body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------------- The process */}
        <section className={`${COLUMN} pt-20 sm:pt-28`}>
          <h2 className={`text-center ${H2}`}>How a sale works</h2>
          <div className="relative mt-12">
            <div className="absolute inset-x-0 top-[5px] hidden h-px bg-ink lg:block" aria-hidden="true" />
            <ol className="grid grid-cols-2 gap-x-6 gap-y-12 text-center sm:grid-cols-3 lg:grid-cols-5">
              {STEPS.map(([photo, title, body], i) => (
                <li key={title} className="flex flex-col items-center">
                  <span
                    className="relative hidden size-[11px] rounded-full border border-ink bg-canvas lg:block"
                    aria-hidden="true"
                  />
                  <p className="text-[13px] font-bold tracking-[0.2em] text-ink-faint lg:mt-6">STEP 0{i + 1}</p>
                  <div className="relative mt-5 h-32 w-24 overflow-hidden rounded-[50%] bg-black">
                    <Photo name={photo} sizes="96px" decorative />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-ink">{title}</h3>
                  <p className="mt-2 max-w-[13rem] text-[13px] leading-relaxed text-ink-soft">{body}</p>
                </li>
              ))}
            </ol>
          </div>
          <p className="mt-12 text-center">
            <ArrowLink href="/how-it-works">The full guide</ArrowLink>
          </p>
        </section>

        {/* -------------------------------------------------------------- The plot */}
        <PlotSheet />

        {/* -------------------------------------------------------------- Where */}
        <section className={`${COLUMN} pt-20 sm:pt-28`}>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <Heading>This is Enugu</Heading>
            <ArrowLink href="/lands">All land for sale</ArrowLink>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3">
            {AREAS.map(([name, area]) => (
              <Link key={name} href={`/lands?q=${encodeURIComponent(area)}`} className="group block">
                <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-black">
                  <Photo
                    name={name}
                    sizes="(min-width: 1024px) 320px, 50vw"
                    className="transition duration-700 ease-out group-hover:scale-105"
                  />
                </div>
                <p className="mt-3 text-[15px] font-semibold text-ink underline-offset-4 group-hover:underline">
                  {area}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------------------- Listings */}
        <section className={`${COLUMN} pt-20 sm:pt-28`}>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <Heading>Fresh land</Heading>
            <ArrowLink href="/lands">All land for sale</ArrowLink>
          </div>
          <div className="mt-12">
            {listings === null ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <CardSkeleton key={i} />
                ))}
              </div>
            ) : listings.length ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {listings.map((l) => (
                  <ListingCard key={l.id} l={l} />
                ))}
              </div>
            ) : (
              <p className={BODY}>
                Nothing listed yet.{" "}
                <Link href="/sell" className="font-semibold text-ink underline underline-offset-4">
                  Be the first to list land
                </Link>
              </p>
            )}
          </div>
        </section>

        {/* -------------------------------------------------------------- Work it out */}
        <Calculator />

        {/* -------------------------------------------------------------- Call to act */}
        <section className="mt-20 bg-sunken py-16 text-center sm:mt-28">
          <h2 className="px-5 text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">
            Ready to sell your land?
          </h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3 px-5">
            <ArrowLink href="/sell">List your land</ArrowLink>
            <ArrowLink href="/lands">Browse land</ArrowLink>
          </div>
        </section>
      </div>
    </>
  );
}

/** What a listing tells a buyer: the plot drawn as on a survey plan, beside its facts. */
function PlotSheet() {
  const facts: [string, string][] = [
    ["Location", "Emene, Enugu East"],
    ["Size", "2 plots · 928 m²"],
    ["Title", "Certificate of Occupancy"],
    ["Title search", "Passed, 4 Nov 2026"],
    ["Price", "₦13.5m"],
  ];
  return (
    <section className={`${COLUMN} pt-20 sm:pt-28`}>
      <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div className="aspect-[4/3] overflow-hidden rounded-3xl border border-ink">
          <PlotArt seed="hero-emene-two-plots" paper animate label="Survey plan of a parcel of land" />
        </div>
        <div>
          <Badge d={icons.ruler} />
          <Heading className="mt-5">Drawn. Measured. Searched.</Heading>
          <dl className="mt-8">
            {facts.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-6 border-t border-line py-3 text-[15px]">
                <dt className="text-ink-soft">{k}</dt>
                <dd className="text-right font-semibold text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-ink-soft">An example of what every listing shows.</p>
        </div>
      </div>
    </section>
  );
}

const PRESETS = [5, 25, 100, 250];

/** What agents would take from a sale at this price, and so what the two sides keep. */
function Calculator() {
  const [millions, setMillions] = useState(25);
  const kobo = millions * 1e6 * 100;
  const each = kobo * 0.1;
  return (
    <section className={`${COLUMN} pt-20 sm:pt-28`}>
      <Heading>Work it out</Heading>
      <div className="mt-10 grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="text-[13px] text-ink-soft">Your price</p>
          <p className="mt-1 font-display text-[2.5rem] leading-none tracking-[-0.02em] text-ink tabular">
            {formatKobo(kobo)}
          </p>
          <input
            type="range"
            min={1}
            max={500}
            step={1}
            value={millions}
            onChange={(e) => setMillions(Number(e.target.value))}
            aria-label="Price of the land, in millions of naira"
            className="range mt-9"
            style={{ "--p": `${((millions - 1) / 499) * 100}%` } as React.CSSProperties}
          />
          <div className="mt-7 flex flex-wrap gap-2">
            {PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMillions(m)}
                aria-pressed={millions === m}
                className={`h-9 rounded-full border px-4 text-sm font-semibold transition ${
                  millions === m ? "border-ink bg-ink text-canvas" : "border-line-strong text-ink hover:border-ink"
                }`}
              >
                ₦{m}m
              </button>
            ))}
          </div>
        </div>

        <dl className="self-end">
          {(
            [
              ["Seller's agent, up to 10%", formatKobo(each)],
              ["Buyer's agent, up to 10%", formatKobo(each)],
              ["DesMind Lands", "₦0"],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-6 border-t border-line py-3 text-[15px]">
              <dt className="text-ink-soft">{k}</dt>
              <dd className="font-semibold text-ink tabular">{v}</dd>
            </div>
          ))}
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t border-ink pt-5">
            <dt className="text-[15px] text-ink">Stays with you both</dt>
            <dd className="font-display text-[2.5rem] leading-none tracking-[-0.02em] text-ink tabular">
              {formatKobo(each * 2)}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

/** A section heading over its short rule. */
function Heading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <h2 className={H2}>{children}</h2>
      <span className="mt-5 block h-0.5 w-12 bg-ink" aria-hidden="true" />
    </div>
  );
}

/** The ringed emblem above a heading. */
function Badge({ d }: { d: string }) {
  return (
    <span className="grid size-16 place-items-center rounded-full border border-ink text-ink" aria-hidden="true">
      <Icon d={d} className="size-7" />
    </span>
  );
}

/** A squared, outlined link ending in an arrow. */
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
