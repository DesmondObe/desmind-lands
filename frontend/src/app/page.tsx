"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { CardSkeleton, ListingCard } from "@/components/listing-card";
import { Photo, PhotoGround, type PhotoName } from "@/components/photo";
import { PlotArt } from "@/components/plot-art";
import { Button, ButtonLink, Eyebrow, Icon, icons } from "@/components/ui";
import { api, type ListingCard as Card } from "@/lib/api";
import { formatKobo, HOME_LGAS } from "@/lib/land";

/*
 * The home page is photographs and plain type: full-width pictures of Enugu State carrying one
 * statement each, and between them white sections set on one grid, divided by thin rules.
 * No boxes, panels or drawn illustrations.
 */

const AREAS: [PhotoName, string][] = [
  ["nsukka-slope", "Nsukka"],
  ["iva-valley", "Enugu"],
  ["ngwo-pines", "Ngwo"],
  ["nike-lake", "Nike"],
  ["achi-above", "Oji River"],
  ["igboeze-hills", "Igbo-Eze"],
];

const STEPS: [string, string][] = [
  ["Offer", "Accept, decline or counter."],
  ["Inspect", "Visit the land. See the papers."],
  ["Sign", "One contract. A witness each."],
  ["Pay", "Buyer to seller, on record."],
  ["Hand over", "Papers and possession."],
];

const PROMISES: [string, string][] = [
  ["Title searched", "At the Ministry of Lands, before listing."],
  ["No money held", "You pay the seller's own account."],
  ["Papers first", "See the title and survey plan before you pay."],
  ["All on record", "Offers, receipts and signatures."],
];

const WRAP = "mx-auto w-full max-w-7xl px-4 sm:px-6";
const H2 = "font-display text-5xl leading-[0.98] tracking-[-0.025em] text-ink sm:text-7xl";

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

  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative flex min-h-dvh flex-col overflow-hidden bg-black text-white">
        <PhotoGround name="enugu-city" eager />
        <div className={`${WRAP} relative flex flex-1 flex-col justify-end pt-40 pb-12`}>
          <div className="animate-rise">
            <Eyebrow light>Enugu State</Eyebrow>
            <h1 className="mt-6 font-display text-[3.6rem] leading-[0.92] tracking-[-0.03em] sm:text-8xl lg:text-[8.5rem]">
              Sell your land.
              <br />
              <span className="text-white/65 italic">Keep every naira.</span>
            </h1>
            <p className="mt-8 max-w-md text-xl leading-snug text-white/85">
              No agents. No commission. Every title searched first.
            </p>

            <form
              onSubmit={search}
              className="mt-9 flex max-w-xl flex-col gap-2 rounded-3xl bg-white p-2 sm:flex-row sm:rounded-full"
            >
              <label className="flex flex-1 items-center gap-3 px-4 text-black">
                <Icon d={icons.search} className="size-5 text-black" />
                <span className="sr-only">Town or area</span>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Area, layout or estate"
                  className="h-12 w-full bg-transparent text-[15px] text-black outline-none placeholder:text-neutral-400"
                />
              </label>
              <select
                value={lga}
                onChange={(e) => setLga(e.target.value)}
                aria-label="Local government area"
                className="h-12 rounded-full bg-white px-4 text-sm font-semibold text-black outline-none sm:w-44"
              >
                <option value="">All of Enugu</option>
                {HOME_LGAS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <Button type="submit" variant="earth" className="h-12">
                Find land
              </Button>
            </form>
          </div>

          <dl className="mt-16 grid grid-cols-3 gap-6 border-t border-white/25 pt-6">
            {[
              ["0%", "commission"],
              ["100%", "titles searched"],
              [stats?.live ? String(stats.live) : "17", stats?.live ? "plots for sale" : "LGAs covered"],
            ].map(([big, small]) => (
              <div key={small}>
                <dt className="sr-only">{small}</dt>
                <dd className="font-display text-4xl text-white tabular sm:text-6xl">{big}</dd>
                <dd className="mt-1 text-[13px] leading-snug text-white/70">{small}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------------------------------------------------------------- What this is */}
      <section className={`${WRAP} py-24 sm:py-32`}>
        <p className="max-w-5xl font-display text-4xl leading-[1.06] tracking-[-0.02em] text-ink sm:text-6xl">
          Land in Enugu, sold by the person who owns it.{" "}
          <span className="text-ink-faint">No agent in the middle. No 10% taken from either side.</span>
        </p>
      </section>

      {/* ---------------------------------------------------------------- The land */}
      <section className={WRAP}>
        <SectionHead
          eyebrow="All 17 LGAs"
          action={
            <ButtonLink href="/lands" variant="secondary">
              All land for sale
              <Icon d={icons.arrow} className="size-4" />
            </ButtonLink>
          }
        >
          This is <span className="text-ink-faint italic">Enugu.</span>
        </SectionHead>

        <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3">
          {AREAS.map(([name, area]) => (
            <Link key={name} href={`/lands?q=${encodeURIComponent(area)}`} className="group block">
              <div className="relative aspect-[4/5] overflow-hidden bg-black">
                <Photo
                  name={name}
                  sizes="(min-width: 1024px) 33vw, 50vw"
                  className="transition duration-700 ease-out group-hover:scale-105"
                />
              </div>
              <p className="mt-4 font-display text-2xl text-ink underline-offset-4 group-hover:underline sm:text-3xl">
                {area}
              </p>
            </Link>
          ))}
        </div>
        <p className="mt-8 text-xs text-ink-faint">
          Enugu State, for illustration. Every listing shows its own photos.{" "}
          <Link href="/credits" className="underline underline-offset-2 hover:text-ink">
            Photo credits
          </Link>
        </p>
      </section>

      {/* ---------------------------------------------------------------- Title search */}
      <PhotoBand
        id="title-search"
        name="nsukka-town"
        eyebrow="Before anything is listed"
        note="At the Enugu State Ministry of Lands."
        action={
          <ButtonLink href="/how-it-works#title-search" variant="light">
            How we search
          </ButtonLink>
        }
      >
        Every title. <span className="text-white/65 italic">Searched first.</span>
      </PhotoBand>

      {/* ---------------------------------------------------------------- The plot */}
      <PlotSheet />

      {/* ---------------------------------------------------------------- How */}
      <section className={`${WRAP} pt-24 sm:pt-32`}>
        <SectionHead
          eyebrow="How a sale works"
          action={
            <ButtonLink href="/how-it-works" variant="secondary">
              The full guide
            </ButtonLink>
          }
        >
          Five steps. <span className="text-ink-faint italic">No middleman.</span>
        </SectionHead>
        <Columns items={STEPS} className="lg:grid-cols-5" numbered />
      </section>

      {/* ---------------------------------------------------------------- Listings */}
      <section className={`${WRAP} pt-24 sm:pt-32`}>
        <SectionHead
          eyebrow="On the market"
          action={
            <ButtonLink href="/lands" variant="secondary">
              All land for sale
              <Icon d={icons.arrow} className="size-4" />
            </ButtonLink>
          }
        >
          Fresh land.
        </SectionHead>
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
            <p className="border-t border-ink pt-6 text-lg text-ink-soft">
              Nothing listed yet.{" "}
              <Link href="/sell" className="font-semibold text-ink underline underline-offset-4">
                Be the first to list land
              </Link>
            </p>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------------- What an agent costs */}
      <PhotoBand name="nsukka-sky" eyebrow="What an agent costs">
        Agents take 10%. <span className="text-white/65 italic">We take nothing.</span>
      </PhotoBand>

      {/* ---------------------------------------------------------------- Work it out */}
      <Calculator />

      {/* ---------------------------------------------------------------- Witnesses */}
      <section className={`${WRAP} pt-24 sm:pt-32`}>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div className="relative aspect-[4/5] overflow-hidden bg-black">
            <Photo name="nsukka-homes" sizes="(min-width: 1024px) 50vw, 100vw" />
          </div>
          <div>
            <Eyebrow>Who a sale needs</Eyebrow>
            <h2 className={`mt-5 ${H2}`}>
              Seller. Buyer. <span className="text-ink-faint italic">Witness.</span>
            </h2>
            <p className="mt-6 max-w-md text-xl leading-snug text-ink-soft">
              Each side brings someone they trust. Nobody else is needed.
            </p>
            <ul className="mt-10 border-b border-line">
              {[
                "Everyone signs the same words.",
                "Change a term and every signature lapses.",
                "Who signed, when and where: on record.",
              ].map((t) => (
                <li key={t} className="border-t border-line py-4 text-lg text-ink">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- Safety */}
      <section className={`${WRAP} pt-24 sm:pt-32`}>
        <SectionHead eyebrow="Why it is safe">Nothing hidden.</SectionHead>
        <Columns items={PROMISES} className="lg:grid-cols-4" />
      </section>

      {/* ---------------------------------------------------------------- CTA: runs into the footer */}
      <PhotoBand
        name="nsukka-grass"
        eyebrow="Ten minutes to list"
        note="Free. And you keep the whole price."
        className="-mb-24"
        action={
          <>
            <ButtonLink href="/sell" variant="light" size="lg">
              List your land
            </ButtonLink>
            <ButtonLink href="/lands" size="lg" className="bg-white/10 ring-1 ring-white/40 hover:bg-white/20">
              Browse land
            </ButtonLink>
          </>
        }
      >
        Your land. Your buyer. <span className="text-white/65 italic">Your money.</span>
      </PhotoBand>
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
  ];
  return (
    <section className={`${WRAP} pt-24 sm:pt-32`}>
      <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-20">
        <div className="aspect-[4/3] border border-ink">
          <PlotArt seed="hero-emene-two-plots" paper animate label="Survey plan of a parcel of land" />
        </div>
        <div>
          <Eyebrow>Every listing</Eyebrow>
          <h2 className={`mt-5 ${H2}`}>
            Drawn. Measured. <span className="text-ink-faint italic">Searched.</span>
          </h2>
          <dl className="mt-10 border-b border-line">
            {facts.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-6 border-t border-line py-4">
                <dt className="text-ink-soft">{k}</dt>
                <dd className="text-right text-lg text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex items-baseline justify-between gap-6">
            <span className="font-mono text-xs text-ink-faint">Example</span>
            <span className="font-display text-5xl text-ink tabular sm:text-6xl">₦13.5m</span>
          </div>
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
    <section className={`${WRAP} pt-24 sm:pt-32`}>
      <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
        <div>
          <Eyebrow>Work it out</Eyebrow>
          <p className="mt-10 text-sm text-ink-soft">Your price</p>
          <p className="mt-1 font-display text-6xl leading-none tracking-[-0.03em] text-ink tabular sm:text-7xl">
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
            className="range mt-12"
            style={{ "--p": `${((millions - 1) / 499) * 100}%` } as React.CSSProperties}
          />
          <div className="mt-8 flex flex-wrap gap-2">
            {PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMillions(m)}
                aria-pressed={millions === m}
                className={`h-9 rounded-full border px-4 text-sm font-semibold transition ${
                  millions === m
                    ? "border-ink bg-ink text-canvas"
                    : "border-line-strong text-ink-soft hover:border-ink hover:text-ink"
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
            <div key={k} className="flex items-baseline justify-between gap-6 border-t border-line py-4">
              <dt className="text-ink-soft">{k}</dt>
              <dd className="font-display text-2xl text-ink tabular">{v}</dd>
            </div>
          ))}
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t border-ink pt-6">
            <dt className="text-lg text-ink">Stays with you both</dt>
            <dd className="font-display text-5xl leading-none tracking-[-0.03em] text-ink tabular sm:text-7xl">
              {formatKobo(each * 2)}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

/** A section's label and heading, with an optional link opposite. */
function SectionHead({ eyebrow, children, action }: { eyebrow: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className={`mt-5 ${H2}`}>{children}</h2>
      </div>
      {action}
    </div>
  );
}

/** Short points side by side, each under a rule: a title and one line. */
function Columns({
  items,
  className,
  numbered,
}: {
  items: [string, string][];
  className?: string;
  numbered?: boolean;
}) {
  return (
    <ol className={`mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 ${className ?? ""}`}>
      {items.map(([title, body], i) => (
        <li key={title} className="border-t border-ink pt-5">
          {numbered && <p className="font-mono text-xs text-ink-faint">{String(i + 1).padStart(2, "0")}</p>}
          <h3 className={`font-display text-2xl text-ink ${numbered ? "mt-8" : ""}`}>{title}</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{body}</p>
        </li>
      ))}
    </ol>
  );
}

/** A photograph the full width of the page, carrying one statement. */
function PhotoBand({
  name,
  eyebrow,
  children,
  note,
  action,
  id,
  className,
}: {
  name: PhotoName;
  eyebrow: string;
  children: ReactNode;
  note?: string;
  action?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`relative mt-24 scroll-mt-16 overflow-hidden bg-black text-white sm:mt-32 ${className ?? ""}`}
    >
      <PhotoGround name={name} />
      <div className={`${WRAP} relative flex min-h-[78vh] flex-col justify-end py-14 sm:py-20`}>
        <Eyebrow light>{eyebrow}</Eyebrow>
        <p className="mt-6 max-w-5xl font-display text-5xl leading-[0.95] tracking-[-0.03em] sm:text-8xl">{children}</p>
        {note && <p className="mt-6 text-xl text-white/85">{note}</p>}
        {action && <div className="mt-8 flex flex-wrap gap-3">{action}</div>}
      </div>
    </section>
  );
}
