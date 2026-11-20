"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CardSkeleton, ListingCard } from "@/components/listing-card";
import { PlotArt } from "@/components/plot-art";
import { Button, ButtonLink, cx, Eyebrow, Icon, icons } from "@/components/ui";
import { api, type ListingCard as Card } from "@/lib/api";
import { formatKobo, STATES } from "@/lib/land";

const STEPS = [
  {
    n: "01",
    title: "Offer",
    body: "The buyer makes an offer. You accept, decline or counter, right there in the deal room.",
    icon: icons.coins,
  },
  {
    n: "02",
    title: "Inspect and verify",
    body: "The buyer visits the land, searches the title and sees your papers. You give the account to be paid into.",
    icon: icons.search,
  },
  {
    n: "03",
    title: "Sign, with witnesses",
    body: "One Contract of Sale, written out in full. Seller, buyer and a witness for each sign it.",
    icon: icons.pen,
  },
  {
    n: "04",
    title: "Pay directly",
    body: "Money goes straight from buyer to seller. Each payment is recorded with its receipt and confirmed.",
    icon: icons.bank,
  },
  {
    n: "05",
    title: "Hand over",
    body: "Documents and possession change hands. The land is sold; the signed agreement is yours as a PDF.",
    icon: icons.key,
  },
];

export default function Home() {
  const router = useRouter();
  const [listings, setListings] = useState<Card[] | null>(null);
  const [stats, setStats] = useState<{ live: number; sold: number; soldValueKobo: number; states: number } | null>(
    null,
  );
  const [q, setQ] = useState("");
  const [state, setState] = useState("");

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
    if (state) p.set("state", state);
    router.push(`/lands${p.size ? `?${p}` : ""}`);
  };

  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="deep-ground relative overflow-hidden text-white">
        <div className="survey-grid absolute inset-0 [--grid-line:oklch(1_0_0/0.04)]" aria-hidden="true" />
        <Contours />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pt-36 pb-24 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pt-44 lg:pb-32">
          <div className="animate-rise">
            <Eyebrow light>Land, direct from the owner</Eyebrow>
            <h1 className="mt-6 font-display text-[3.1rem] leading-[0.98] font-light tracking-[-0.02em] sm:text-7xl lg:text-[5.4rem]">
              Sell your land.
              <br />
              <span className="text-brass-300 italic">Keep every naira.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-white/75">
              Agents take 5–10% from the seller <em>and</em> the buyer. Here, you deal with each other directly, with
              witnesses, a signed agreement and every payment on record.
            </p>

            <form
              onSubmit={search}
              className="mt-10 flex max-w-xl flex-col gap-2 rounded-[1.75rem] bg-white p-2 shadow-lift sm:flex-row sm:rounded-full"
            >
              <label className="flex flex-1 items-center gap-3 px-4 text-forest-950">
                <Icon d={icons.search} className="size-5 text-forest-700" />
                <span className="sr-only">Town or area</span>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Town, area or estate"
                  className="h-12 w-full bg-transparent text-[15px] text-forest-950 outline-none placeholder:text-stone-400"
                />
              </label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                aria-label="State"
                className="h-12 rounded-full bg-stone-100 px-4 text-sm font-semibold text-forest-900 outline-none sm:w-40"
              >
                <option value="">All states</option>
                {STATES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <Button type="submit" variant="earth" className="h-12">
                Find land
              </Button>
            </form>

            <div className="mt-10 flex flex-wrap gap-x-10 gap-y-4 text-sm">
              {[
                ["0%", "commission, either side"],
                [stats ? String(stats.live) : "—", "plots on the market"],
                ["2+", "witnesses on every sale"],
              ].map(([big, small]) => (
                <div key={small}>
                  <p className="font-display text-3xl text-white">{big}</p>
                  <p className="text-white/55">{small}</p>
                </div>
              ))}
            </div>
          </div>

          <HeroPlan />
        </div>
      </section>

      {/* ---------------------------------------------------------------- Savings */}
      <Savings />

      {/* ---------------------------------------------------------------- Listings */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div>
            <Eyebrow>On the market</Eyebrow>
            <h2 className="mt-4 font-display text-4xl leading-tight text-ink sm:text-5xl">Fresh land, from owners</h2>
          </div>
          <ButtonLink href="/lands" variant="secondary">
            All land for sale
            <Icon d={icons.arrow} className="size-4" />
          </ButtonLink>
        </div>
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
          <FirstListing />
        )}
      </section>

      {/* ---------------------------------------------------------------- How */}
      <section className="bleed border-y border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <Eyebrow>How a sale works</Eyebrow>
              <h2 className="mt-4 font-display text-4xl leading-tight text-ink sm:text-5xl">
                Five steps. <br />
                <span className="text-ink-faint">No middleman.</span>
              </h2>
              <p className="mt-5 max-w-sm leading-relaxed text-ink-soft">
                Every deal has its own room where both of you see the same thing: the offers, the checks, the agreement,
                the signatures and the money.
              </p>
              <ButtonLink href="/how-it-works" variant="secondary" className="mt-8">
                The full guide
              </ButtonLink>
            </div>
            <ol className="relative space-y-4">
              <span className="absolute top-6 bottom-6 left-[27px] w-px bg-line-strong" aria-hidden="true" />
              {STEPS.map((s) => (
                <li key={s.n} className="relative flex gap-6 rounded-3xl p-4 transition hover:bg-canvas sm:p-5">
                  <span className="relative grid size-14 shrink-0 place-items-center rounded-2xl border border-line bg-surface text-forest-700 shadow-soft">
                    <Icon d={s.icon} className="size-6" />
                  </span>
                  <div className="pt-1">
                    <p className="font-mono text-xs text-earth-600">{s.n}</p>
                    <h3 className="mt-1 font-display text-2xl text-ink">{s.title}</h3>
                    <p className="mt-2 max-w-lg leading-relaxed text-ink-soft">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- Witnesses */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <SignatureSheet />
          <div>
            <Eyebrow>Seller, buyer, witness</Eyebrow>
            <h2 className="mt-4 font-display text-4xl leading-tight text-ink sm:text-5xl">
              The three people a land sale actually needs.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-ink-soft">
              Agents add nothing a sale needs. Witnesses do. Each side names someone they trust to attest their
              signature: a relative, a friend, their lawyer. Witnesses sign through a private link, with no account.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                "One agreement, fixed and fingerprinted: everyone signs exactly the same words.",
                "Change any term and every signature lapses, so nobody signs one thing and holds another.",
                "A certificate records who signed, when and from where.",
              ].map((t) => (
                <li key={t} className="flex gap-3 text-ink-soft">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-forest-100 text-forest-700">
                    <Icon d={icons.check} className="size-3.5" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- Safety */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[
            [icons.shield, "Reviewed listings", "Our staff check every listing and its papers before it goes live."],
            [icons.bank, "We never hold money", "You pay the seller's own account. Nobody else's, whoever asks."],
            [icons.doc, "Papers before payment", "Buyers with a deal see the title documents and survey plan."],
            [icons.eye, "Everything on record", "Offers, messages, receipts and signatures, kept for both sides."],
          ].map(([icon, title, body]) => (
            <div key={title} className="rounded-3xl border border-line bg-surface p-7 shadow-soft">
              <span className="grid size-12 place-items-center rounded-2xl bg-earth-50 text-earth-600">
                <Icon d={icon!} className="size-6" />
              </span>
              <h3 className="mt-6 font-display text-xl text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- CTA */}
      <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6">
        <div className="deep-ground relative overflow-hidden rounded-[2.5rem] px-8 py-16 text-white sm:px-16 sm:py-20">
          <div className="absolute inset-y-0 right-0 hidden w-1/2 opacity-60 md:block" aria-hidden="true">
            <PlotArt seed="cta-plan-desmind" landUse="agricultural" />
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--deep)] to-transparent" />
          </div>
          <div className="relative max-w-xl">
            <Eyebrow light>List in ten minutes</Eyebrow>
            <h2 className="mt-5 font-display text-4xl leading-tight sm:text-5xl">
              Your land. Your buyer. <span className="text-brass-300">Your money.</span>
            </h2>
            <p className="mt-5 text-lg text-white/70">
              Photos, the size and the title you hold. We review it, and buyers start making offers.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="/sell" variant="light" size="lg">
                List your land, free
              </ButtonLink>
              <ButtonLink href="/lands" size="lg" className="bg-white/10 ring-1 ring-white/25 hover:bg-white/20">
                Browse land
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/** Contour lines drifting across the hero. */
function Contours() {
  return (
    <svg
      className="absolute inset-0 size-full opacity-[0.18]"
      preserveAspectRatio="none"
      viewBox="0 0 1200 800"
      aria-hidden="true"
    >
      {Array.from({ length: 14 }, (_, i) => {
        const y = 60 + i * 55;
        const d = `M-50 ${y} C 200 ${y - 60 + (i % 3) * 30}, 420 ${y + 70}, 640 ${y + 10} S 1000 ${y - 80 + (i % 4) * 25}, 1260 ${y + 20}`;
        return (
          <path
            key={d}
            d={d}
            fill="none"
            stroke={i % 4 === 0 ? "#D2AE62" : "white"}
            strokeWidth={i % 4 === 0 ? 1.2 : 0.7}
          />
        );
      })}
    </svg>
  );
}

/** The hero's picture: a survey plan, and the deal it is part of, floating over it. */
function HeroPlan() {
  return (
    <div className="relative mx-auto w-full max-w-md animate-rise [animation-delay:150ms] lg:max-w-none">
      <div className="overflow-hidden rounded-[2rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/15">
        <div className="aspect-[4/3.4]">
          <PlotArt seed="hero-emene-two-plots" animate label="Survey plan of a parcel of land" />
        </div>
        <div className="flex items-center justify-between bg-[oklch(0.15_0.025_165)] px-6 py-4 text-sm">
          <div>
            <p className="font-display text-lg text-white">2 plots · Emene, Enugu</p>
            <p className="text-white/50">Certificate of Occupancy</p>
          </div>
          <p className="font-display text-2xl text-brass-300">₦13.5m</p>
        </div>
      </div>

      <div className="absolute -bottom-8 -left-4 w-64 animate-float rounded-3xl bg-white p-5 text-forest-950 shadow-lift sm:-left-10">
        <p className="text-[10px] font-bold tracking-[0.2em] text-earth-600 uppercase">Contract of sale</p>
        <ul className="mt-3 space-y-2.5 text-[13px]">
          {[
            ["Seller", "Chidi E."],
            ["Buyer", "Amaka O."],
            ["Witnesses", "2 of 2"],
          ].map(([who, name]) => (
            <li key={who} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <span className="grid size-5 place-items-center rounded-full bg-forest-600 text-white">
                  <Icon d={icons.check} className="size-3" />
                </span>
                <span className="font-semibold">{who}</span>
              </span>
              <span className="text-stone-500">{name}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="absolute -top-6 -right-2 rounded-2xl bg-earth-500 px-4 py-3 text-white shadow-lift [animation-delay:1.2s] sm:-right-6">
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase opacity-80">Agent fees</p>
        <p className="font-display text-2xl leading-none">₦0</p>
      </div>
    </div>
  );
}

/** What agents would have taken from a sale of this price, on both sides. */
function Savings() {
  const [millions, setMillions] = useState(25);
  const kobo = millions * 1e6 * 100;
  const each = kobo * 0.1;
  return (
    <section className="mx-auto -mt-1 max-w-7xl px-4 pt-24 sm:px-6">
      <div className="grid overflow-hidden rounded-[2.5rem] border border-line bg-surface shadow-soft lg:grid-cols-[1.1fr_1fr]">
        <div className="p-8 sm:p-12">
          <Eyebrow>What an agent costs</Eyebrow>
          <h2 className="mt-4 font-display text-4xl leading-tight text-ink sm:text-[2.8rem]">
            On a <span className="text-earth-600">{formatKobo(kobo)}</span> plot
          </h2>
          <p className="mt-4 max-w-md leading-relaxed text-ink-soft">
            Slide to your price. Agents commonly charge up to 10% to each side, for introducing two people who could
            have met directly.
          </p>
          <input
            type="range"
            min={1}
            max={500}
            step={1}
            value={millions}
            onChange={(e) => setMillions(Number(e.target.value))}
            aria-label="Price of the land, in millions of naira"
            className="mt-10 w-full accent-[oklch(0.6_0.15_40)]"
          />
          <div className="mt-2 flex justify-between font-mono text-xs text-ink-faint">
            <span>₦1m</span>
            <span>₦500m</span>
          </div>
        </div>
        <div className="survey-grid flex flex-col justify-center gap-4 border-t border-line bg-sunken p-8 sm:p-12 lg:border-t-0 lg:border-l">
          <Row label="Seller pays an agent" value={`up to ${formatKobo(each)}`} />
          <Row label="Buyer pays an agent" value={`up to ${formatKobo(each)}`} />
          <div className="my-2 h-px bg-line-strong" />
          <Row label="Taken from the sale" value={formatKobo(each * 2)} strike />
          <div className="mt-2 flex items-end justify-between rounded-3xl bg-forest-900 p-6 text-white dark:bg-forest-100">
            <div>
              <p className="text-[11px] font-bold tracking-[0.2em] text-brass-300 uppercase">On DesMind Lands</p>
              <p className="mt-1 text-sm text-white/70 dark:text-forest-900">Commission, either side</p>
            </div>
            <p className="font-display text-5xl text-white dark:text-forest-900">₦0</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value, strike }: { label: string; value: string; strike?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-ink-soft">{label}</span>
      <span
        className={cx(
          "font-display text-2xl text-ink tabular-nums",
          strike && "text-earth-600 line-through decoration-2",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** A signature sheet: the agreement as everyone signs it. */
function SignatureSheet() {
  const rows = [
    ["The Vendor", "Chidi Eze", "seller"],
    ["Witness to the Vendor", "Ngozi Eze", "witness"],
    ["The Purchaser", "Amaka Obi", "buyer"],
    ["Witness to the Purchaser", "Emeka Obi", "witness"],
  ];
  return (
    <div className="relative">
      <div className="absolute -inset-4 -rotate-2 rounded-[2.5rem] bg-earth-100" aria-hidden="true" />
      <div className="relative rounded-[2rem] border border-line bg-surface p-8 shadow-lift sm:p-10">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-[0.22em] text-earth-600 uppercase">Signed electronically</p>
            <p className="mt-2 font-display text-2xl text-ink">Contract of Sale of Land</p>
          </div>
          <span className="rounded-full bg-forest-100 px-3 py-1 text-xs font-semibold text-forest-800">Complete</span>
        </div>
        <div className="mt-8 space-y-5">
          {rows.map(([role, name, kind]) => (
            <div
              key={role}
              className="flex items-end justify-between gap-6 border-b border-dashed border-line-strong pb-3"
            >
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-ink-faint uppercase">{role}</p>
                <p
                  className={cx(
                    "mt-1 font-display text-2xl italic",
                    kind === "witness" ? "text-earth-600" : "text-forest-800",
                  )}
                >
                  {name}
                </p>
              </div>
              <Icon d={icons.check} className="mb-1 size-5 text-forest-600" />
            </div>
          ))}
        </div>
        <p className="mt-6 font-mono text-[10px] leading-relaxed break-all text-ink-faint">
          SHA-256 · 9f2c4e81b7d03a65e1c9f04d2b8a7e36c5d1f90ab4e2c7186d3f5a0b9e4c2d71
        </p>
      </div>
    </div>
  );
}

function FirstListing() {
  return (
    <div className="survey-grid grid items-center gap-8 rounded-[2rem] border border-dashed border-line-strong p-10 md:grid-cols-[1fr_auto]">
      <div>
        <p className="font-display text-3xl text-ink">Be the first to list land here.</p>
        <p className="mt-2 text-ink-soft">Listing is free, and you keep the whole price.</p>
      </div>
      <Link href="/sell" className="font-semibold text-earth-600 underline underline-offset-4">
        List your land →
      </Link>
    </div>
  );
}
