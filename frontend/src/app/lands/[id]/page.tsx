"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import { TitleBars } from "@/components/listing-card";
import { PlotArt } from "@/components/plot-art";
import { useSession } from "@/components/session";
import { Loading, Page } from "@/components/shell";
import { toast } from "@/components/toast";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  cx,
  ErrorText,
  Eyebrow,
  Field,
  Icon,
  Input,
  icons,
  statusTone,
  Textarea,
  TitleSearchSeal,
} from "@/components/ui";
import { ApiError, api, type Listing, openFile } from "@/lib/api";
import {
  agentCut,
  FEATURES,
  formatDay,
  formatKobo,
  formatSize,
  LAND_USE,
  LISTING_STATUS,
  nairaToKobo,
  shortNaira,
  TITLE_LABEL,
  TITLE_STRENGTH,
} from "@/lib/land";

type Detail = {
  listing: Listing;
  photos: { id: string; filename: string; url: string }[];
  paperKinds: Record<string, number>;
  papers: { id: string; kind: string; filename: string }[];
  seller: { id: string; fullName: string; since: string; listed: number; sold: number } | null;
  viewer: { mine: boolean; admin: boolean; insider: boolean; saved: boolean };
  myDeal: { id: string; stage: string } | null;
  interest: number;
};

export default function LandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<{ message: string; missing: boolean } | null>(null);
  const [photo, setPhoto] = useState(0);
  const [panelSeen, setPanelSeen] = useState(true);
  const loaded = useRef(false);
  const panel = useRef<HTMLElement>(null);

  const load = () =>
    api<Detail>(`/listings/${id}`).then(
      (d) => {
        loaded.current = true;
        setData(d);
        setError(null);
      },
      (err) => {
        // A refresh that fails (after saving, say) leaves the page as it was.
        if (loaded.current) return toast(err.message, "error");
        setError({ message: err.message, missing: err instanceof ApiError && err.status === 404 });
      },
    );
  // biome-ignore lint/correctness/useExhaustiveDependencies: load on id change.
  useEffect(() => {
    load();
  }, [id]);

  // Left and right turn the photos, unless someone is typing an offer.
  const photoCount = data?.photos.length ?? 0;
  useEffect(() => {
    if (photoCount < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
      setPhoto((n) => (n + (e.key === "ArrowRight" ? 1 : -1) + photoCount) % photoCount);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photoCount]);

  // On a phone the offer panel is a long scroll down: a bar at the foot of the screen leads
  // to it, and steps aside once the panel itself is in view.
  const ready = data !== null;
  useEffect(() => {
    const el = panel.current;
    if (!ready || !el) return;
    const seen = new IntersectionObserver(([entry]) => setPanelSeen(entry?.isIntersecting ?? true));
    seen.observe(el);
    return () => seen.disconnect();
  }, [ready]);

  if (error)
    return (
      <Page>
        <div className="mx-auto max-w-md py-16 text-center">
          <p className="font-display text-3xl">{error.missing ? "Land not found" : "This page did not load"}</p>
          <p className="mt-3 text-ink-soft">
            {error.missing ? "It may have been withdrawn by its owner, or the link is wrong." : error.message}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {!error.missing && (
              <Button
                onClick={() => {
                  setError(null);
                  load();
                }}
              >
                Try again
              </Button>
            )}
            <ButtonLink href="/lands" variant={error.missing ? "primary" : "secondary"}>
              Browse land for sale
            </ButtonLink>
          </div>
        </div>
      </Page>
    );
  if (!data) return <Loading />;

  const { listing: l, photos, seller, viewer } = data;
  const cut = agentCut(l.priceKobo);
  const strength = TITLE_STRENGTH[l.titleKind];
  const canOffer = l.status === "published" && !viewer.mine && !(data.myDeal && data.myDeal.stage !== "cancelled");
  const mapQuery = l.latitude != null ? `${l.latitude},${l.longitude}` : `${l.town}, ${l.lga}, ${l.state}, Nigeria`;

  return (
    <Page wide>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[13px] text-ink-faint">
        <Link href="/lands" className="font-medium hover:text-ink">
          Land for sale
        </Link>
        <span aria-hidden="true">/</span>
        <span>{l.state} State</span>
        {l.lga && (
          <>
            <span aria-hidden="true">/</span>
            <Link href={`/lands?lga=${encodeURIComponent(l.lga)}`} className="font-medium hover:text-ink">
              {l.lga}
            </Link>
          </>
        )}
        <span aria-hidden="true">/</span>
        <span className="text-ink-soft">{l.town}</span>
      </nav>

      {(viewer.mine || viewer.admin) && l.status !== "published" && (
        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-3xl border border-amber-100 bg-amber-50 px-6 py-4 text-sm text-amber-800">
          <Badge tone={statusTone[l.status]}>{LISTING_STATUS[l.status]}</Badge>
          {l.reviewNote ? (
            <span>Reviewer: “{l.reviewNote}”</span>
          ) : (
            <span>Only you{viewer.admin ? " and staff" : ""} can see this page.</span>
          )}
          {viewer.mine && (
            <Link href={`/dashboard/listings/${l.id}`} className="ml-auto font-semibold underline">
              Manage listing
            </Link>
          )}
        </div>
      )}

      {/* Gallery */}
      <div className="mt-6 grid animate-rise gap-3 lg:grid-cols-[2fr_1fr]">
        <div className="relative aspect-[16/10] overflow-hidden rounded-4xl bg-forest-950">
          {photos.length ? (
            // biome-ignore lint/performance/noImgElement: signed storage URL.
            <img
              src={photos[photo]?.url}
              alt={`${l.title} (${photo + 1} of ${photos.length})`}
              className="size-full object-cover"
            />
          ) : (
            <PlotArt seed={l.id} landUse={l.landUse} animate />
          )}
          {photos.length > 1 && (
            <div className="absolute right-4 bottom-4 flex gap-2">
              {(["‹", "›"] as const).map((arrow, i) => (
                <button
                  key={arrow}
                  type="button"
                  aria-label={i ? "Next photo" : "Previous photo"}
                  onClick={() => setPhoto((photo + (i ? 1 : -1) + photos.length) % photos.length)}
                  className="grid size-11 place-items-center rounded-full bg-white/92 text-forest-950 shadow-lift backdrop-blur transition hover:bg-white"
                >
                  <Icon d={icons.arrow} className={cx("size-4", !i && "rotate-180")} />
                </button>
              ))}
            </div>
          )}
          {photos.length > 0 && (
            <span className="absolute top-4 left-4 rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              {photo + 1} / {photos.length}
            </span>
          )}
        </div>
        <div className={cx("grid gap-3", photos.length ? "grid-cols-2 lg:grid-cols-1" : "min-h-64")}>
          {photos.length > 0 && (
            <div className="relative overflow-hidden rounded-4xl bg-forest-950">
              <PlotArt seed={l.id} landUse={l.landUse} label="Survey plan illustration" />
              <span className="absolute bottom-3 left-3 rounded-full bg-black/40 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
                Illustration
              </span>
            </div>
          )}
          {photos.length > 1 ? (
            <div className="grid grid-cols-3 gap-2 overflow-hidden rounded-4xl">
              {photos.slice(0, 6).map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPhoto(i)}
                  aria-label={`Photo ${i + 1} of ${photos.length}`}
                  aria-current={i === photo}
                  className={cx(
                    "relative aspect-square overflow-hidden",
                    i === photo && "ring-4 ring-earth-500 ring-inset",
                  )}
                >
                  {/* biome-ignore lint/performance/noImgElement: signed storage URL. */}
                  <img src={p.url} alt="" loading="lazy" className="size-full object-cover" />
                  {i === 5 && photos.length > 6 && (
                    <span className="absolute inset-0 grid place-items-center bg-black/55 text-sm font-bold text-white">
                      +{photos.length - 6}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <iframe
              title="Map"
              className="size-full min-h-64 rounded-4xl border border-line grayscale-[0.4]"
              loading="lazy"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=${l.latitude != null ? 15 : 12}&output=embed`}
            />
          )}
        </div>
      </div>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_400px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone[l.status]} live={l.status === "published"}>
              {LISTING_STATUS[l.status]}
            </Badge>
            <Badge tone="quiet">{LAND_USE[l.landUse]}</Badge>
            {data.interest > 0 && l.status === "published" && (
              <Badge tone="earth">
                {data.interest} buyer{data.interest > 1 ? "s" : ""} in talks
              </Badge>
            )}
            {["published", "under_offer", "sold"].includes(l.status) && (
              <ShareButton title={l.title} where={l.town} price={shortNaira(l.priceKobo)} />
            )}
          </div>
          <h1 className="mt-5 font-display text-4xl leading-[1.08] text-ink sm:text-5xl">{l.title}</h1>
          <p className="mt-4 flex items-center gap-2 text-lg text-ink-soft">
            <Icon d={icons.pin} className="text-earth-500" />
            {l.addressLine ? `${l.addressLine}, ` : ""}
            {l.town}
            {l.lga ? `, ${l.lga}` : ""}, {l.state}
          </p>

          <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-4">
            {[
              ["Size", formatSize(l.sizeValue, l.sizeUnit)],
              ["Use", LAND_USE[l.landUse]],
              ["Title", TITLE_LABEL[l.titleKind]],
              ["Listed", formatDay(l.publishedAt ?? l.createdAt)],
            ].map(([k, v]) => (
              <div key={k} className="bg-surface p-5">
                <dt className="text-xs font-semibold tracking-wide text-ink-faint uppercase">{k}</dt>
                <dd className="mt-1.5 font-display text-lg leading-snug text-ink">{v}</dd>
              </div>
            ))}
          </dl>

          {l.description && (
            <section className="mt-12">
              <h2 className="font-display text-2xl text-ink">About the land</h2>
              <p className="mt-4 text-[16px] leading-[1.8] whitespace-pre-line text-ink-soft">{l.description}</p>
            </section>
          )}

          {l.features.length > 0 && (
            <section className="mt-12">
              <h2 className="font-display text-2xl text-ink">What the seller says</h2>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {l.features.map((f) => (
                  <li key={f} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
                    <span className="grid size-7 place-items-center rounded-full bg-forest-100 text-forest-700">
                      <Icon d={icons.check} className="size-4" />
                    </span>
                    {FEATURES[f] ?? f}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-12">
            <h2 className="font-display text-2xl text-ink">Title search</h2>
            {l.titleSearchedAt ? (
              <div className="mt-5 overflow-hidden rounded-3xl border border-forest-200 bg-forest-50/60 dark:border-forest-300">
                <div className="flex flex-wrap items-center justify-between gap-4 p-6">
                  <TitleSearchSeal at={l.titleSearchedAt} />
                  {l.titleSearchRef && (
                    <span className="rounded-full bg-surface px-3 py-1 font-mono text-xs text-ink-soft ring-1 ring-line">
                      Ref. {l.titleSearchRef}
                    </span>
                  )}
                </div>
                <div className="border-t border-forest-200 bg-surface px-6 py-5 text-sm leading-relaxed text-ink-soft dark:border-forest-300">
                  {l.titleSearchNote ? (
                    <p>
                      <span className="font-semibold text-ink">What the search showed: </span>
                      {l.titleSearchNote}
                    </p>
                  ) : (
                    <p>
                      Before listing, DesMind Lands searched this title at the {l.state} State Ministry of Lands and
                      found it on record. The search reference and findings open to you once you make an offer.
                    </p>
                  )}
                  <p className="mt-2 text-xs text-ink-faint">
                    A search shows what the Ministry&apos;s records said on the day. Still visit the land, and take your
                    own legal advice before you pay.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-3xl border border-dashed border-line-strong bg-surface p-6 text-sm text-ink-soft">
                The title search for this land is still being done at the Ministry of Lands.
              </div>
            )}
          </section>

          <section className="mt-12">
            <h2 className="font-display text-2xl text-ink">Title and papers</h2>
            <div className="mt-5 rounded-3xl border border-line bg-surface p-6">
              <div className="flex items-start gap-4">
                <span className="mt-1">
                  <TitleBars kind={l.titleKind} />
                </span>
                <div>
                  <p className="font-display text-xl text-ink">{TITLE_LABEL[l.titleKind]}</p>
                  {l.titleReference && <p className="mt-1 font-mono text-sm text-ink-soft">Ref. {l.titleReference}</p>}
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{strength?.note}</p>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
                {(["title_document", "survey_plan"] as const).map((k) => (
                  <span
                    key={k}
                    className={cx(
                      "rounded-full px-3 py-1.5 text-xs font-semibold",
                      data.paperKinds[k] ? "bg-forest-100 text-forest-800" : "bg-stone-100 text-stone-700",
                    )}
                  >
                    {data.paperKinds[k] ? "✓" : "–"}{" "}
                    {k === "title_document" ? "Title document uploaded" : "Survey plan uploaded"}
                  </span>
                ))}
              </div>
              {viewer.insider && data.papers.length > 0 ? (
                <ul className="mt-5 space-y-2">
                  {data.papers.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => openFile(p.id).catch((e) => toast(e.message, "error"))}
                        className="flex w-full items-center gap-3 rounded-2xl bg-sunken px-4 py-3 text-left text-sm hover:bg-forest-50"
                      >
                        <Icon d={icons.doc} className="text-earth-600" />
                        <span className="flex-1 truncate">{p.filename}</span>
                        <span className="text-ink-faint">Open</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                !viewer.insider && (
                  <p className="mt-4 text-sm text-ink-faint">
                    The papers, the exact address and the title number open to you once you make an offer.
                  </p>
                )
              )}
            </div>
          </section>

          {l.latitude != null || photos.length > 1 ? (
            <section className="mt-12">
              <h2 className="font-display text-2xl text-ink">Where it is</h2>
              <iframe
                title="Map of the land"
                className="mt-5 h-80 w-full rounded-3xl border border-line"
                loading="lazy"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=${l.latitude != null ? 15 : 12}&output=embed`}
              />
              {!viewer.insider && l.latitude != null && (
                <p className="mt-2 text-xs text-ink-faint">Approximate. The exact pin opens to buyers in a deal.</p>
              )}
            </section>
          ) : null}
        </div>

        {/* The buying panel */}
        <aside ref={panel} id="offer" className="scroll-mt-24 lg:sticky lg:top-28 lg:self-start">
          <div className="overflow-hidden rounded-4xl border border-line bg-surface shadow-lift">
            <div className="deep-ground p-7 text-white">
              <p className="text-xs font-semibold tracking-[0.18em] text-brass-300 uppercase">
                {l.negotiable ? "Asking price · negotiable" : "Fixed price"}
              </p>
              <p className="mt-2 font-display text-[2.75rem] leading-none tabular">{formatKobo(l.priceKobo)}</p>
              <p className="mt-4 text-sm text-white/65">
                An agent on each side would take up to <strong className="text-white">{formatKobo(cut.high)}</strong>{" "}
                from this sale. Here: nothing.
              </p>
              {l.titleSearchedAt && (
                <div className="mt-6 border-t border-white/12 pt-5">
                  <TitleSearchSeal at={l.titleSearchedAt} light />
                </div>
              )}
            </div>
            <div className="p-7">
              <BuyPanel data={data} onSaved={load} />
            </div>
          </div>

          {seller && (
            <Card className="mt-5 flex items-center gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-earth-100 font-display text-xl text-earth-700">
                {seller.fullName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join("")}
              </span>
              <div>
                <p className="text-xs font-semibold tracking-wide text-ink-faint uppercase">Sold by its owner</p>
                <p className="font-display text-xl text-ink">{seller.fullName}</p>
                <p className="text-sm text-ink-soft">
                  Member since {formatDay(seller.since)} · {seller.sold} sold
                </p>
              </div>
            </Card>
          )}
        </aside>
      </div>

      {canOffer && (
        <div
          // `inert` rather than only hidden: off screen, its button must not take focus.
          inert={panelSeen}
          className={cx(
            "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_oklch(0_0_0/0.2)] backdrop-blur-xl transition duration-300 lg:hidden print:hidden",
            panelSeen && "translate-y-full opacity-0",
          )}
        >
          <div className="mx-auto flex max-w-xl items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-display text-2xl leading-none text-ink tabular">{formatKobo(l.priceKobo)}</p>
              <p className="mt-1 truncate text-xs text-ink-faint">
                {l.negotiable ? "Negotiable" : "Fixed price"} · no agent's commission
              </p>
            </div>
            <Button
              variant="earth"
              onClick={() => panel.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="shrink-0"
            >
              Make an offer
            </Button>
          </div>
        </div>
      )}
    </Page>
  );
}

/** Land is passed on by WhatsApp: the phone's own share sheet where there is one, else copy the link. */
function ShareButton({ title, where, price }: { title: string; where: string; price: string }) {
  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}`;
    if (navigator.share) {
      // Closing the sheet rejects: that is a choice, not an error.
      await navigator
        .share({ title, text: `${title}, ${where}: ${price}. Direct from the owner, no agent.`, url })
        .catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch {
      toast("Could not copy. Copy the address from your browser instead.", "error");
    }
  };
  return (
    <button
      type="button"
      onClick={share}
      className="ml-auto inline-flex h-10 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-[13px] font-semibold text-ink shadow-soft transition hover:border-forest-600"
    >
      <Icon d={icons.link} className="size-4" />
      Share
    </button>
  );
}

function BuyPanel({ data, onSaved }: { data: Detail; onSaved: () => void }) {
  const router = useRouter();
  const { me } = useSession();
  const l = data.listing;
  const [amount, setAmount] = useState(l.negotiable ? "" : String(l.priceKobo / 100));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Back from signing up: the offer they had typed is still there (see `offer` below).
  useEffect(() => {
    const typed = new URLSearchParams(window.location.search).get("offer");
    if (typed && l.negotiable && nairaToKobo(typed)) setAmount(typed);
  }, [l.negotiable]);

  if (data.viewer.mine)
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-soft">This is your land.</p>
        <ButtonLink href={`/dashboard/listings/${l.id}`} className="w-full">
          Manage the listing
        </ButtonLink>
      </div>
    );
  if (data.myDeal && data.myDeal.stage !== "cancelled")
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-soft">You are already in a deal for this land.</p>
        <ButtonLink href={`/deals/${data.myDeal.id}`} variant="earth" className="w-full">
          Open your deal room
        </ButtonLink>
      </div>
    );
  if (l.status === "sold")
    return <p className="text-center font-display text-xl text-ink">Sold through DesMind Lands, with no agent.</p>;
  if (l.status === "under_offer")
    return (
      <p className="text-sm leading-relaxed text-ink-soft">
        The seller has accepted an offer and the buyer is doing their checks. Save it: if the deal falls through, it
        comes back on the market.
      </p>
    );

  const save = async () => {
    if (!me) return router.push(`/login?next=/lands/${l.id}`);
    setSaving(true);
    try {
      await api(`/listings/${l.id}/save`, data.viewer.saved ? "DELETE" : "POST");
      toast(data.viewer.saved ? "Removed from saved land" : "Saved. Find it on your dashboard.");
      onSaved();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  async function offer(e: React.FormEvent) {
    e.preventDefault();
    const kobo = nairaToKobo(amount);
    if (!me) {
      const back = `/lands/${l.id}${kobo && l.negotiable ? `?offer=${encodeURIComponent(amount.trim())}` : ""}`;
      return router.push(`/signup?next=${encodeURIComponent(back)}`);
    }
    if (!kobo) return setError("Enter your offer in naira, e.g. 12,500,000 or 12.5m.");
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ deal: { id: string } }>(`/listings/${l.id}/deals`, "POST", { amountKobo: kobo, note });
      toast("Offer sent. Your deal room is open.");
      router.push(`/deals/${r.deal.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const kobo = nairaToKobo(amount);
  // How the offer sits against the asking price, in the buyer's own terms.
  const gap = kobo && l.negotiable ? Math.round(((kobo - l.priceKobo) / l.priceKobo) * 100) : 0;
  const against = gap === 0 ? "the asking price" : `${Math.abs(gap)}% ${gap < 0 ? "below" : "above"} asking`;
  return (
    <form onSubmit={offer} className="space-y-4">
      <Eyebrow>Make an offer</Eyebrow>
      <Field
        label="Your offer (₦)"
        hint={
          kobo ? (
            <span className="font-semibold text-ink-soft">
              {formatKobo(kobo)}
              {l.negotiable && kobo !== l.priceKobo && <span className="font-normal text-ink-faint"> · {against}</span>}
            </span>
          ) : (
            "e.g. 12,500,000 or 12.5m"
          )
        }
      >
        <Input
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          disabled={!l.negotiable}
          onChange={(e) => setAmount(e.target.value)}
          className="h-14 font-display text-2xl"
        />
      </Field>
      <Field label="A note to the seller (optional)">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="min-h-20"
          placeholder="When you could inspect, how you would pay…"
        />
      </Field>
      <ErrorText error={error} />
      <Button type="submit" variant="earth" size="lg" busy={busy} className="w-full">
        {me ? "Send offer" : "Sign up to make an offer"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={save}
        busy={saving}
        aria-pressed={data.viewer.saved}
        className="w-full"
      >
        <Icon d={icons.heart} className={cx("size-4", data.viewer.saved && "fill-earth-500 text-earth-500")} />
        {data.viewer.saved ? "Saved" : "Save for later"}
      </Button>
      <p className="text-xs leading-relaxed text-ink-faint">
        An offer opens a private deal room with the seller. Nothing is binding until you both sign the agreement, with
        witnesses.
      </p>
    </form>
  );
}
