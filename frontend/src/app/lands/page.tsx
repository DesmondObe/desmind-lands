"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CardSkeleton, ListingCard } from "@/components/listing-card";
import { Page } from "@/components/shell";
import { Button, cx, Empty, ErrorText, Eyebrow, Icon, icons, Select } from "@/components/ui";
import { api, type ListingCard as Card } from "@/lib/api";
import { LAND_USE, STATES, TITLE_LABEL } from "@/lib/land";

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
  const [q, setQ] = useState(params.get("q") ?? "");

  const query = params.toString();
  useEffect(() => {
    setData(null);
    api<Result>(`/listings?${query}`).then(setData, (err) => setError(err.message));
  }, [query]);

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in changes)) next.delete("page");
    router.push(`${pathname}?${next}`, { scroll: false });
  };

  const band = `${params.get("minPrice") ?? ""}-${params.get("maxPrice") ?? ""}`;
  const filtersOn = ["state", "titleKind", "landUse", "minPrice", "maxPrice", "q"].some((k) => params.get(k));

  return (
    <Page wide>
      <div className="animate-rise">
        <Eyebrow>Land for sale</Eyebrow>
        <h1 className="mt-4 font-display text-5xl leading-[1.02] text-ink sm:text-6xl">
          Buy straight from <span className="text-earth-600 italic">the owner.</span>
        </h1>
      </div>

      <div className="sticky top-[4.5rem] z-30 -mx-4 mt-10 border-b border-line bg-canvas/90 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: q.trim() });
          }}
          className="flex flex-col gap-3 lg:flex-row lg:items-center"
        >
          <label className="flex h-12 flex-1 items-center gap-3 rounded-full border border-line-strong bg-surface px-5 focus-within:border-forest-600">
            <Icon d={icons.search} className="text-ink-faint" />
            <span className="sr-only">Search</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a town, area or estate"
              className="w-full bg-transparent text-[15px] outline-none placeholder:text-ink-faint"
            />
          </label>
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            <Select
              aria-label="State"
              value={params.get("state") ?? ""}
              onChange={(e) => update({ state: e.target.value })}
              className="h-12 w-auto min-w-36 rounded-full py-0"
            >
              <option value="">All states</option>
              {STATES.map((s) => (
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
              className="h-12 w-auto min-w-36 rounded-full py-0"
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
              className="h-12 w-auto min-w-36 rounded-full py-0"
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
              className="h-12 w-auto min-w-32 rounded-full py-0"
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
              className="h-12 w-auto min-w-36 rounded-full py-0"
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </Select>
          </div>
        </form>
      </div>

      <div className="mt-8 flex items-center justify-between text-sm text-ink-soft">
        <p>
          {data ? (
            <>
              <strong className="text-ink">{data.total}</strong> {data.total === 1 ? "piece" : "pieces"} of land
            </>
          ) : (
            " "
          )}
        </p>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={params.get("includeSold") === "true"}
            onChange={(e) => update({ includeSold: e.target.checked ? "true" : "" })}
            className="size-4 accent-[oklch(0.26_0.048_162)]"
          />
          Show sold land
        </label>
      </div>

      <div className="mt-6">
        <ErrorText error={error} />
        {data === null ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : data.listings.length ? (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.listings.map((l, i) => (
                <div key={l.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                  <ListingCard l={l} />
                </div>
              ))}
            </div>
            {data.pages > 1 && (
              <div className="mt-12 flex items-center justify-center gap-2">
                {Array.from({ length: data.pages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => update({ page: p === 1 ? "" : String(p) })}
                    className={cx(
                      "grid size-10 place-items-center rounded-full text-sm font-semibold",
                      p === data.page ? "bg-primary text-on-primary" : "text-ink-soft hover:bg-sunken",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <Empty
            title="No land matches, yet"
            action={
              filtersOn ? (
                <Button variant="secondary" onClick={() => router.push(pathname)}>
                  Clear the filters
                </Button>
              ) : undefined
            }
          >
            New land is listed every week. Try a wider area, or a different price.
          </Empty>
        )}
      </div>
    </Page>
  );
}

export default function LandsPage() {
  return (
    <Suspense>
      <Market />
    </Suspense>
  );
}
