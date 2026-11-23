"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ListingCard } from "@/components/listing-card";
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

  const figures: [string, string, string][] = [
    ["Open deals", String(open.length), icons.chat],
    ["Waiting on you", String(yourMove.length), icons.pen],
    ["Listings", String(listings.length), icons.pin],
    ["Kept from agents", kept ? formatKobo(kept * 0.1) : "₦0", icons.coins],
  ];
  const tabs: [Tab, string, number][] = [
    ["deals", "Deals", deals.length],
    ["listings", "My land", listings.length],
    ["saved", "Saved", saved.length],
  ];
  const fresh = !deals.length && !listings.length;

  return (
    <Page>
      {/* ------------------------------------------------------------ Who, and what to do */}
      <div className="flex animate-rise flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[13px] font-bold tracking-[0.2em] text-ink-faint uppercase">Welcome, {first}</p>
          <h1 className="mt-3 font-display text-[2rem] leading-[1.1] tracking-[-0.02em] text-ink sm:text-[2.5rem]">
            Your land and deals
          </h1>
          <span className="mt-5 block h-0.5 w-12 bg-ink" aria-hidden="true" />
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

      {/* ------------------------------------------------------------ Figures */}
      <dl className="mt-10 grid grid-cols-2 gap-y-8 border-y border-line py-8 lg:grid-cols-4">
        {figures.map(([label, value, icon], i) => (
          <div
            key={label}
            className={cx(
              "flex items-center gap-4 px-1 sm:px-6",
              i > 0 && "lg:border-l lg:border-line",
              !i && "lg:pl-0",
            )}
          >
            <span
              className="grid size-12 shrink-0 place-items-center rounded-full border border-ink text-ink"
              aria-hidden="true"
            >
              <Icon d={icon} className="size-5" />
            </span>
            <div>
              <dd className="font-display text-[2rem] leading-none text-ink tabular">{value}</dd>
              <dt className="mt-1.5 text-[13px] text-ink-soft">{label}</dt>
            </div>
          </div>
        ))}
      </dl>

      {/* ------------------------------------------------------------ Waiting on you */}
      {!!yourMove.length && (
        <section className="mt-10 rounded-3xl bg-ink p-6 text-canvas sm:p-8">
          <h2 className="flex items-center gap-3 text-lg font-semibold tracking-tight">
            <span className="size-2 animate-pulse-dot rounded-full bg-canvas" aria-hidden="true" />
            {yourMove.length === 1 ? "One deal is waiting on you" : `${yourMove.length} deals are waiting on you`}
          </h2>
          <ul className="mt-5">
            {yourMove.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/deals/${d.id}`}
                  className="group flex items-center justify-between gap-5 border-t border-canvas/25 py-4"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold">{d.listing.title}</span>
                    <span className="mt-0.5 block text-[14px] leading-snug">{d.nextStep}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-[13px] font-semibold">
                    Open
                    <Icon d={icons.arrow} className="size-4 transition group-hover:translate-x-1" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ------------------------------------------------------------ Nothing yet: where to begin */}
      {fresh && (
        <section className="mt-10 grid gap-5 sm:grid-cols-2">
          {(
            [
              [
                "/sell",
                "Sell your land",
                "List it free. We search the title, then buyers make offers.",
                icons.pin,
                true,
              ],
              ["/lands", "Buy land", "Every title is searched before the land is listed.", icons.search, false],
            ] as const
          ).map(([href, title, body, icon, dark]) => (
            <Link
              key={href}
              href={href}
              className={cx(
                "group flex min-h-48 flex-col rounded-3xl p-6 transition",
                dark ? "bg-ink text-canvas" : "bg-sunken text-ink",
              )}
            >
              <Icon d={icon} className="size-8" />
              <h2 className="mt-5 text-lg font-semibold tracking-tight">{title}</h2>
              <p className="mt-1.5 max-w-xs text-[14px] leading-relaxed">{body}</p>
              <span className="mt-auto flex items-center gap-2 pt-6 text-[13px] font-semibold">
                Start
                <Icon d={icons.arrow} className="size-4 transition group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </section>
      )}

      {/* ------------------------------------------------------------ Deals, land, saved */}
      <div className="mt-12 inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-sunken p-1">
        {tabs.map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            aria-current={tab === key ? "page" : undefined}
            onClick={() => setTab(key)}
            className={cx(
              "flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold whitespace-nowrap transition",
              tab === key ? "bg-ink text-canvas" : "text-ink hover:bg-canvas",
            )}
          >
            {label}
            <span className="tabular">{count}</span>
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "deals" &&
          (deals.length ? (
            <ul className="border-b border-line">
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
                    {l.status === "published" && <Badge tone={statusTone[l.status]}>{LISTING_STATUS[l.status]}</Badge>}
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

const STAGE_ICON: Record<string, string> = {
  negotiating: icons.chat,
  checks: icons.eye,
  agreement: icons.pen,
  payment: icons.bank,
  completed: icons.check,
  cancelled: icons.x,
};

/** One deal as a ruled row: where it stands, what comes next, and the price. */
function DealItem({ d }: { d: DealRow }) {
  const idx = STAGES.findIndex((s) => s.key === d.stage);
  const closed = d.stage === "completed" || d.stage === "cancelled";
  const mine = d.yourMove && !closed;
  return (
    <li>
      <Link
        href={`/deals/${d.id}`}
        className="group grid items-center gap-x-5 gap-y-4 border-t border-line py-5 sm:grid-cols-[auto_1fr_auto]"
      >
        <span
          className={cx(
            "hidden size-12 place-items-center rounded-full sm:grid",
            mine ? "bg-ink text-canvas" : "border border-ink text-ink",
          )}
          aria-hidden="true"
        >
          <Icon d={STAGE_ICON[d.stage] ?? icons.doc} className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-bold tracking-[0.14em] text-ink-faint uppercase">
            {d.role === "seller" ? "Selling to" : "Buying from"} {d.counterpart}
          </p>
          <p className="mt-1 truncate text-[17px] font-semibold tracking-tight text-ink underline-offset-4 group-hover:underline">
            {d.listing.title}
          </p>
          <p className="mt-1 text-[14px] leading-snug text-ink-soft">
            {closed ? (
              `${STAGE_LABEL[d.stage]} · ${d.listing.town}, ${d.listing.state} · ${timeAgo(d.updatedAt)}`
            ) : (
              <>
                {mine && <strong className="font-semibold text-ink">Your move: </strong>}
                {d.nextStep}
              </>
            )}
          </p>
          {!closed && (
            <ol className="mt-4 flex max-w-md items-start">
              {STAGES.slice(0, 4).map((s, i) => (
                <li key={s.key} className="relative flex-1 text-[11px] font-semibold">
                  {i > 0 && (
                    <span
                      className={cx("absolute top-[5px] right-1/2 h-px w-full", i <= idx ? "bg-ink" : "bg-line-strong")}
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={cx(
                      "relative mx-auto block size-[11px] rounded-full border",
                      i <= idx ? "border-ink bg-ink" : "border-line-strong bg-canvas",
                    )}
                    aria-hidden="true"
                  />
                  <span className={cx("mt-1.5 block text-center", i <= idx ? "text-ink" : "text-ink-faint")}>
                    {s.label}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="flex items-center gap-5 sm:text-right">
          <div>
            <p className="text-[12px] text-ink-soft">
              {d.agreedKobo ? "Agreed" : d.openOfferKobo ? "On the table" : "Asking"}
            </p>
            <p className="font-display text-2xl text-ink tabular">
              {formatKobo(d.agreedKobo ?? d.openOfferKobo ?? d.listing.priceKobo)}
            </p>
          </div>
          <Icon d={icons.arrow} className="ml-auto size-5 text-ink transition group-hover:translate-x-1" />
        </div>
      </Link>
    </li>
  );
}
