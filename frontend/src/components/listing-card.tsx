import Link from "next/link";
import type { ListingCard as Card } from "@/lib/api";
import { formatSize, LAND_USE, LISTING_STATUS, shortNaira, TITLE_SHORT, TITLE_STRENGTH } from "@/lib/land";
import { PlotArt } from "./plot-art";
import { cx, Icon, icons } from "./ui";

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
        "group flex flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-lift",
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
              "size-full object-cover transition duration-700 group-hover:scale-[1.04]",
              sold && "grayscale-[0.6]",
            )}
          />
        ) : (
          <PlotArt seed={l.id} landUse={l.landUse} className="transition duration-700 group-hover:scale-[1.04]" />
        )}
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent"
          aria-hidden="true"
        />
        <div className="absolute top-3 left-3 flex gap-2">
          {l.status !== "published" && (
            <span
              className={cx(
                "rounded-full px-3 py-1 text-[11px] font-bold tracking-wide uppercase backdrop-blur",
                sold ? "bg-white/90 text-forest-900" : "bg-earth-500/90 text-white",
              )}
            >
              {LISTING_STATUS[l.status] ?? l.status}
            </span>
          )}
          <span className="rounded-full bg-black/35 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
            {LAND_USE[l.landUse]}
          </span>
        </div>
        <div className="absolute right-3 bottom-3 left-3 flex items-end justify-between gap-3">
          <p className="font-display text-[28px] leading-none text-white drop-shadow">{shortNaira(l.priceKobo)}</p>
          {l.photoCount > 1 && (
            <span className="rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
              {l.photoCount} photos
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="line-clamp-2 font-display text-[19px] leading-snug text-ink">{l.title}</h3>
        <p className="flex items-center gap-1.5 text-sm text-ink-soft">
          <Icon d={icons.pin} className="size-4 text-earth-500" />
          {l.town}
          {l.lga ? `, ${l.lga}` : ""}, {l.state}
        </p>
        <div className="mt-auto flex items-center justify-between border-t border-line pt-3 text-[13px] text-ink-soft">
          <span className="flex items-center gap-1.5">
            <Icon d={icons.ruler} className="size-4 text-ink-faint" />
            {formatSize(l.sizeValue, l.sizeUnit)}
          </span>
          <span className="flex items-center gap-2 font-semibold text-ink">
            <TitleBars kind={l.titleKind} />
            {TITLE_SHORT[l.titleKind]}
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
