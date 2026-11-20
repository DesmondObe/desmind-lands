import Link from "next/link";
import type { ListingCard as Card } from "@/lib/api";
import { formatSize, LAND_USE, LISTING_STATUS, shortNaira, TITLE_SHORT, TITLE_STRENGTH } from "@/lib/land";
import { PlotArt } from "./plot-art";
import { cx, Icon, icons, TitleSearchSeal } from "./ui";

/** The strength of a title as three small bars. */
export function TitleBars({ kind, light }: { kind: string; light?: boolean }) {
  const level = TITLE_STRENGTH[kind]?.level ?? 1;
  return (
    <span className="inline-flex items-end gap-0.5" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={cx(
            "w-1 rounded-full",
            i === 1 ? "h-1.5" : i === 2 ? "h-2.5" : "h-3.5",
            i <= level ? (light ? "bg-brass-300" : "bg-forest-600") : light ? "bg-white/25" : "bg-line-strong",
          )}
        />
      ))}
    </span>
  );
}

export function ListingCard({ l, href, className }: { l: Card; href?: string; className?: string }) {
  const sold = l.status === "sold";
  return (
    <Link
      href={href ?? `/lands/${l.id}`}
      className={cx(
        "group flex flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-card transition duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift",
        className,
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-forest-950">
        {l.coverUrl ? (
          // biome-ignore lint/performance/noImgElement: signed storage URLs, sized by the card.
          <img
            src={l.coverUrl}
            alt=""
            loading="lazy"
            className={cx(
              "size-full object-cover transition duration-700 ease-out group-hover:scale-[1.03]",
              sold && "grayscale-[0.6]",
            )}
          />
        ) : (
          <PlotArt
            seed={l.id}
            landUse={l.landUse}
            className="transition duration-700 ease-out group-hover:scale-[1.03]"
          />
        )}
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 via-45% to-black/15"
          aria-hidden="true"
        />
        <div className="absolute inset-x-3 top-3 flex flex-wrap items-start gap-1.5">
          {l.status !== "published" && (
            <span
              className={cx(
                "rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase backdrop-blur",
                sold ? "bg-white/92 text-forest-900" : "bg-earth-500/92 text-white",
              )}
            >
              {LISTING_STATUS[l.status] ?? l.status}
            </span>
          )}
          {l.titleSearchedAt && <TitleSearchSeal compact light />}
        </div>
        <div className="absolute inset-x-4 bottom-3.5 flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-[30px] leading-none text-white tabular drop-shadow-sm">
              {shortNaira(l.priceKobo)}
            </p>
            {!l.negotiable && <p className="mt-1 text-[11px] font-semibold text-white/75">Fixed price</p>}
          </div>
          {l.photoCount > 1 && (
            <span className="flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
              <Icon d={icons.eye} className="size-3.5" />
              {l.photoCount}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[11px] font-bold tracking-[0.14em] text-earth-600 uppercase dark:text-accent">
          {LAND_USE[l.landUse]} · {formatSize(l.sizeValue, l.sizeUnit)}
        </p>
        <h3 className="mt-2 line-clamp-2 font-display text-[19px] leading-snug text-ink transition group-hover:text-forest-700">
          {l.title}
        </h3>
        <p className="mt-2 flex items-center gap-1.5 text-[14px] text-ink-soft">
          <Icon d={icons.pin} className="size-4 shrink-0 text-ink-faint" />
          <span className="truncate">
            {l.town}
            {l.lga ? `, ${l.lga}` : ""}
          </span>
        </p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <TitleBars kind={l.titleKind} />
            {TITLE_SHORT[l.titleKind]}
          </span>
          <span className="flex items-center gap-1 text-[13px] font-semibold text-forest-700 opacity-0 transition group-hover:opacity-100 dark:text-primary">
            View
            <Icon d={icons.arrow} className="size-3.5 transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="aspect-[4/3] animate-pulse bg-sunken" />
      <div className="space-y-3 p-5">
        <div className="h-5 w-3/4 animate-pulse rounded bg-sunken" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-sunken" />
        <div className="h-4 w-full animate-pulse rounded bg-sunken" />
      </div>
    </div>
  );
}
