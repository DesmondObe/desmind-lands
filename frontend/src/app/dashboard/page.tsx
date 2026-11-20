"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ListingCard } from "@/components/listing-card";
import { PlotArt } from "@/components/plot-art";
import { useRequireSignIn } from "@/components/session";
import { Loading, Page } from "@/components/shell";
import { Badge, Button, ButtonLink, cx, Empty, Icon, icons, statusTone } from "@/components/ui";
import { api, type ListingCard as Card, type DealRow } from "@/lib/api";
import { formatKobo, LISTING_STATUS, STAGE_LABEL, STAGES, timeAgo } from "@/lib/land";

type Tab = "deals" | "listings" | "saved";

export default function Dashboard() {
  const { me } = useRequireSignIn();
  const [deals, setDeals] = useState<DealRow[] | null>(null);
  const [listings, setListings] = useState<Card[] | null>(null);
  const [saved, setSaved] = useState<Card[] | null>(null);
  const [tab, setTab] = useState<Tab>("deals");

  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` loads again on "Try again".
  useEffect(() => {
    if (!me) return;
    let current = true;
    setError(null);
    Promise.all([
      api<{ deals: DealRow[] }>("/me/deals"),
      api<{ listings: Card[] }>("/me/listings"),
      api<{ listings: Card[] }>("/me/saved"),
    ]).then(
      ([d, l, s]) => {
        if (!current) return;
        setDeals(d.deals);
        setListings(l.listings);
        setSaved(s.listings);
      },
      (err) => {
        if (current) setError(err.message);
      },
    );
    return () => {
      current = false;
    };
  }, [me, attempt]);

  useEffect(() => {
    if (deals && listings && !deals.length && listings.length) setTab("listings");
  }, [deals, listings]);

  if (error && !(deals && listings && saved))
    return (
      <Page>
        <div className="mx-auto max-w-md py-16 text-center">
          <p className="font-display text-3xl">Your dashboard did not load</p>
          <p className="mt-3 text-ink-soft">{error}</p>
          <Button className="mt-8" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
        </div>
      </Page>
    );
  if (!me || !deals || !listings || !saved) return <Loading />;

  const open = deals.filter((d) => !["completed", "cancelled"].includes(d.stage));
  const yourMove = open.filter((d) => d.yourMove);
  const kept = deals
    .filter((d) => d.stage === "completed" && d.role === "seller")
    .reduce((n, d) => n + (d.agreedKobo ?? 0), 0);
  const first = me.user.fullName.split(/\s+/)[0];

  return (
    <Page wide>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="animate-rise">
          <p className="text-sm font-semibold text-earth-600">Welcome, {first}</p>
          <h1 className="mt-2 font-display text-5xl text-ink">
            {yourMove.length ? (
              <>
                {yourMove.length} {yourMove.length === 1 ? "deal needs" : "deals need"} you
              </>
            ) : (
              "Your land and deals"
            )}
          </h1>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/lands" variant="secondary">
            Browse land
          </ButtonLink>
          <ButtonLink href="/sell">
            <Icon d={icons.plus} className="size-4" />
            List land
          </ButtonLink>
        </div>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Open deals", String(open.length), icons.chat],
          ["Waiting on you", String(yourMove.length), icons.pen],
          ["Listings", String(listings.length), icons.pin],
          ["Kept from agents", kept ? formatKobo(kept * 0.1) : "₦0", icons.coins],
        ].map(([label, value, icon]) => (
          <div key={label} className="rounded-3xl border border-line bg-surface p-6 shadow-soft">
            <div className="flex items-center justify-between text-ink-faint">
              <span className="text-sm font-semibold">{label}</span>
              <Icon d={icon!} className="size-5" />
            </div>
            <p className="mt-4 font-display text-4xl text-ink">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 flex gap-1 border-b border-line">
        {(
          [
            ["deals", `Deals (${deals.length})`],
            ["listings", `My land (${listings.length})`],
            ["saved", `Saved (${saved.length})`],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-current={tab === key ? "page" : undefined}
            onClick={() => setTab(key)}
            className={cx(
              "-mb-px border-b-2 px-5 py-3 text-sm font-semibold transition",
              tab === key ? "border-earth-500 text-ink" : "border-transparent text-ink-faint hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === "deals" &&
          (deals.length ? (
            <ul className="space-y-3">
              {deals.map((d) => (
                <DealItem key={d.id} d={d} />
              ))}
            </ul>
          ) : (
            <Empty title="No deals yet" action={<ButtonLink href="/lands">Find land</ButtonLink>}>
              When you make an offer on land, or a buyer makes one on yours, its deal room appears here.
            </Empty>
          ))}

        {tab === "listings" &&
          (listings.length ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((l) => (
                <div key={l.id} className="relative">
                  <ListingCard l={l} href={`/dashboard/listings/${l.id}`} />
                  <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                    <Badge tone={statusTone[l.status]}>{LISTING_STATUS[l.status]}</Badge>
                    {!!l.openDeals && <Badge tone="earth">{l.openDeals} in talks</Badge>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="You have not listed any land" action={<ButtonLink href="/sell">List your land</ButtonLink>}>
              Listing is free, and you keep the whole price.
            </Empty>
          ))}

        {tab === "saved" &&
          (saved.length ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {saved.map((l) => (
                <ListingCard key={l.id} l={l} />
              ))}
            </div>
          ) : (
            <Empty title="Nothing saved yet">Tap “Save for later” on any land to keep it here.</Empty>
          ))}
      </div>
    </Page>
  );
}

function DealItem({ d }: { d: DealRow }) {
  const idx = STAGES.findIndex((s) => s.key === d.stage);
  const closed = d.stage === "completed" || d.stage === "cancelled";
  return (
    <li>
      <Link
        href={`/deals/${d.id}`}
        className={cx(
          "group grid items-center gap-5 rounded-3xl border bg-surface p-4 shadow-soft transition hover:shadow-lift sm:grid-cols-[96px_1fr_auto] sm:p-5",
          d.yourMove && !closed ? "border-earth-300" : "border-line",
        )}
      >
        <div className="hidden aspect-square overflow-hidden rounded-2xl sm:block">
          <PlotArt seed={d.listing.id} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone[d.stage]} live={d.yourMove && !closed}>
              {STAGE_LABEL[d.stage]}
            </Badge>
            <span className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
              You are {d.role === "seller" ? "selling" : "buying"} · with {d.counterpart}
            </span>
          </div>
          <p className="mt-2 truncate font-display text-xl text-ink">{d.listing.title}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {closed ? (
              `${d.listing.town}, ${d.listing.state} · ${timeAgo(d.updatedAt)}`
            ) : (
              <>
                {d.yourMove && <strong className="text-earth-600">Your move: </strong>}
                {d.nextStep}
              </>
            )}
          </p>
          {!closed && (
            <div className="mt-3 flex max-w-sm gap-1">
              {STAGES.slice(0, 4).map((s, i) => (
                <span key={s.key} className={cx("h-1 flex-1 rounded-full", i <= idx ? "bg-earth-500" : "bg-line")} />
              ))}
            </div>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-ink-faint">
            {d.agreedKobo ? "Agreed" : d.openOfferKobo ? "On the table" : "Asking"}
          </p>
          <p className="font-display text-2xl text-ink">
            {formatKobo(d.agreedKobo ?? d.openOfferKobo ?? d.listing.priceKobo)}
          </p>
        </div>
      </Link>
    </li>
  );
}
