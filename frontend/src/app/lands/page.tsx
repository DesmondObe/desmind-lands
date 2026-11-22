"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { CardSkeleton, ListingCard } from "@/components/listing-card";
import { Photo } from "@/components/photo";
import { Page } from "@/components/shell";
import { Button, cx, Empty, ErrorText, Eyebrow, Icon, icons, Select } from "@/components/ui";
import { api, type ListingCard as Card } from "@/lib/api";
import { HOME_LGAS, LAND_USE, POPULAR_AREAS, TITLE_LABEL } from "@/lib/land";

type Result = { listings: Card[]; total: number; page: number; pages: number };

const PRICE_BANDS: [string, string, string][] = [
  ["", "", "Any price"],
  ["", "5000000", "Under ₦5m"],
  ["5000000", "20000000", "₦5m – ₦20m"],
  ["20000000", "50000000", "₦20m – ₦50m"],
  ["50000000", "150000000", "₦50m – ₦150m"],
  ["150000000", "", "Over ₦150m"],
];

function Market() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [q, setQ] = useState(params.get("q") ?? "");
  const results = useRef<HTMLDivElement>(null);

  const query = params.toString();
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the search on "Try again".
  useEffect(() => {
    // Only the latest search may land: a slow answer to an older filter must not replace it.
    let current = true;
    setLoading(true);
    setError(null);
    api<Result>(`/listings?${query}`)
      .then(
        (r) => {
          if (current) setData(r);
        },
        (err) => {
          if (current) setError(err.message);
        },
      )
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [query, attempt]);

  // Back and forward change the address, not the box: keep the two the same.
  const urlQ = params.get("q") ?? "";
  useEffect(() => setQ(urlQ), [urlQ]);

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in changes)) next.delete("page");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const goToPage = (p: number) => {
    update({ page: p === 1 ? "" : String(p) });
    results.current?.scrollIntoView({ block: "start" });
  };

  const band = `${params.get("minPrice") ?? ""}-${params.get("maxPrice") ?? ""}`;
  // Price is one filter with two ends.
  const filterCount =
    ["lga", "titleKind", "landUse", "q"].filter((k) => params.get(k)).length +
    (params.get("minPrice") || params.get("maxPrice") ? 1 : 0);
  const filtersOn = filterCount > 0;
  const activeQ = urlQ;
  const clearFilters = () => {
    setQ("");
    update({ lga: "", titleKind: "", landUse: "", minPrice: "", maxPrice: "", q: "" });
  };

  return (
    <Page wide>
      <div className="grid animate-rise items-end gap-8 lg:grid-cols-[1fr_auto]">
        <div>
          <Eyebrow>Land for sale in Enugu State</Eyebrow>
          <h1 className="mt-5 font-display text-5xl leading-[0.98] tracking-[-0.025em] text-ink sm:text-6xl">
            Buy from <span className="italic">the owner.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-soft">No agent. No commission. Every title searched first.</p>
        </div>
        <div className="relative hidden h-52 w-[30rem] overflow-hidden rounded-3xl bg-black lg:block">
          <Photo name="achi-plot" sizes="480px" eager />
        </div>
      </div>

      <div className="no-scrollbar -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {POPULAR_AREAS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => {
              setQ(activeQ === a ? "" : a);
              update({ q: activeQ === a ? "" : a });
            }}
            className={cx(
              "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ring-1 transition",
              activeQ === a
                ? "bg-primary text-on-primary ring-primary"
                : "bg-surface text-ink-soft ring-line hover:text-ink hover:ring-line-strong",
            )}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="sticky top-[4.5rem] z-30 -mx-4 mt-6 border-b border-line bg-canvas/90 px-4 py-3.5 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: q.trim() });
          }}
          className="flex flex-col gap-2.5"
        >
          <label className="flex h-12 min-w-0 items-center gap-3 rounded-full border border-line-strong bg-surface px-4 shadow-soft transition focus-within:border-forest-600 focus-within:ring-4 focus-within:ring-forest-600/12">
            <Icon d={icons.search} className="text-ink-faint" />
            <span className="sr-only">Search</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              type="search"
              enterKeyHint="search"
              placeholder="Search an area, layout or estate"
              className="w-full bg-transparent text-[15px] outline-none placeholder:text-ink-faint [&::-webkit-search-cancel-button]:hidden"
            />
            {q && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQ("");
                  if (activeQ) update({ q: "" });
                }}
                className="-mr-2 grid size-9 shrink-0 place-items-center rounded-full text-ink-faint transition hover:bg-sunken hover:text-ink"
              >
                <Icon d={icons.x} className="size-4" />
              </button>
            )}
          </label>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            <Select
              aria-label="Local government area"
              value={params.get("lga") ?? ""}
              onChange={(e) => update({ lga: e.target.value })}
              className="h-10 w-auto! max-w-52 shrink-0 truncate rounded-full! py-0 pr-9 pl-4 text-[14px] font-medium"
            >
              <option value="">All of Enugu</option>
              {HOME_LGAS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Select
              aria-label="Price"
              value={band}
              onChange={(e) => {
                const [minPrice = "", maxPrice = ""] = e.target.value.split("-");
                update({ minPrice, maxPrice });
              }}
              className="h-10 w-auto! max-w-52 shrink-0 truncate rounded-full! py-0 pr-9 pl-4 text-[14px] font-medium"
            >
              {PRICE_BANDS.map(([min, max, label]) => (
                <option key={label} value={`${min}-${max}`}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Title"
              value={params.get("titleKind") ?? ""}
              onChange={(e) => update({ titleKind: e.target.value })}
              className="h-10 w-auto! max-w-52 shrink-0 truncate rounded-full! py-0 pr-9 pl-4 text-[14px] font-medium"
            >
              <option value="">Any title</option>
              {Object.entries(TITLE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Use"
              value={params.get("landUse") ?? ""}
              onChange={(e) => update({ landUse: e.target.value })}
              className="h-10 w-auto! max-w-52 shrink-0 truncate rounded-full! py-0 pr-9 pl-4 text-[14px] font-medium"
            >
              <option value="">Any use</option>
              {Object.entries(LAND_USE).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Sort"
              value={params.get("sort") ?? "newest"}
              onChange={(e) => update({ sort: e.target.value === "newest" ? "" : e.target.value })}
              className="h-10 w-auto! max-w-52 shrink-0 truncate rounded-full! py-0 pr-9 pl-4 text-[14px] font-medium"
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </Select>
          </div>
        </form>
      </div>

      <div
        ref={results}
        className="mt-8 flex scroll-mt-52 flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm text-ink-soft"
      >
        <p aria-live="polite" className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {data ? (
            <>
              <strong className="text-ink tabular">{data.total}</strong> {data.total === 1 ? "piece" : "pieces"} of land
              {params.get("lga") ? ` in ${params.get("lga")}` : " in Enugu State"}
            </>
          ) : (
            " "
          )}
          {filtersOn && (
            <button
              type="button"
              onClick={clearFilters}
              className="font-semibold text-earth-600 underline decoration-earth-300 underline-offset-4 hover:text-earth-700 dark:text-accent"
            >
              Clear {filterCount === 1 ? "filter" : `${filterCount} filters`}
            </button>
          )}
        </p>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={params.get("includeSold") === "true"}
            onChange={(e) => update({ includeSold: e.target.checked ? "true" : "" })}
            className="size-4 accent-primary"
          />
          Show sold land
        </label>
      </div>

      <div className="mt-6">
        {error && (
          <div className="flex flex-wrap items-center gap-3">
            <ErrorText error={error} />
            <Button variant="secondary" size="sm" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </Button>
          </div>
        )}
        {error ? null : data === null ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : data.listings.length ? (
          <>
            <div
              aria-busy={loading}
              className={cx(
                "grid gap-6 transition-opacity duration-200 sm:grid-cols-2 lg:grid-cols-3",
                loading && "opacity-50",
              )}
            >
              {data.listings.map((l, i) => (
                <div key={l.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                  <ListingCard l={l} />
                </div>
              ))}
            </div>
            {data.pages > 1 && <Pagination page={data.page} pages={data.pages} onPage={goToPage} />}
          </>
        ) : (
          <Empty
            title="No land matches, yet"
            action={
              filtersOn ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Clear the filters
                </Button>
              ) : undefined
            }
          >
            New land in Enugu is listed every week. Try a wider area, or a different price.
          </Empty>
        )}
      </div>
    </Page>
  );
}

/** Previous and next, and the pages around this one: 1 … 4 5 6 … 20. */
function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  const shown = [...new Set([1, page - 1, page, page + 1, pages])].filter((p) => p >= 1 && p <= pages);
  const step = "grid h-10 place-items-center rounded-full text-sm font-semibold transition";
  return (
    <nav aria-label="Pages" className="mt-12 flex items-center justify-center gap-1.5">
      <button
        type="button"
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
        aria-label="Previous page"
        className={cx(step, "w-10 text-ink-soft hover:bg-sunken disabled:pointer-events-none disabled:opacity-35")}
      >
        <Icon d={icons.arrow} className="size-4 rotate-180" />
      </button>
      {shown.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - (shown[i - 1] ?? p) > 1 && (
            <span className="px-1 text-ink-faint" aria-hidden="true">
              …
            </span>
          )}
          <button
            type="button"
            onClick={() => onPage(p)}
            aria-current={p === page ? "page" : undefined}
            aria-label={`Page ${p}`}
            className={cx(
              step,
              "min-w-10 px-3 tabular",
              p === page ? "bg-primary text-on-primary" : "text-ink-soft hover:bg-sunken",
            )}
          >
            {p}
          </button>
        </span>
      ))}
      <button
        type="button"
        disabled={page === pages}
        onClick={() => onPage(page + 1)}
        aria-label="Next page"
        className={cx(step, "w-10 text-ink-soft hover:bg-sunken disabled:pointer-events-none disabled:opacity-35")}
      >
        <Icon d={icons.arrow} className="size-4" />
      </button>
    </nav>
  );
}

export default function LandsPage() {
  return (
    <Suspense>
      <Market />
    </Suspense>
  );
}
