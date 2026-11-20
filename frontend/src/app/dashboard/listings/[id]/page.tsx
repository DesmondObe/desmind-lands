"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import { ListingForm } from "@/components/listing-form";
import { PlotArt } from "@/components/plot-art";
import { useRequireSignIn } from "@/components/session";
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
  Icon,
  icons,
  statusTone,
  TitleSearchSeal,
} from "@/components/ui";
import { UploadZone } from "@/components/uploads";
import { api, type Listing, openFile } from "@/lib/api";
import { LISTING_STATUS } from "@/lib/land";

type Detail = {
  listing: Listing;
  photos: { id: string; filename: string; url: string }[];
  papers: { id: string; kind: string; filename: string }[];
  viewer: { mine: boolean };
};

const PAPER_LABEL: Record<string, string> = {
  title_document: "Title document",
  survey_plan: "Survey plan",
  other: "Other paper",
};

export default function ManageListing({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { me } = useRequireSignIn();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<Detail>(`/listings/${id}`).then(setData, (e) => setError(e.message)), [id]);
  useEffect(() => {
    if (me) load();
  }, [me, load]);

  if (error)
    return (
      <Page>
        <ErrorText error={error} />
      </Page>
    );
  if (!data) return <Loading />;
  const l = data.listing;
  if (!data.viewer.mine)
    return (
      <Page>
        <ErrorText error="Only the seller manages this listing." />
      </Page>
    );

  const status = async (next: string, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    try {
      await api(`/listings/${id}/status`, "POST", { status: next });
      toast(
        next === "in_review"
          ? "Sent for review. We will search the title at the Ministry of Lands, then publish it."
          : "Listing updated",
      );
      await load();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const move = async (from: number, to: number) => {
    // One move at a time: a second tap before the first lands would reorder from the old order.
    if (busy) return;
    const ids = data.photos.map((p) => p.id);
    const [x] = ids.splice(from, 1);
    ids.splice(to, 0, x!);
    setBusy(true);
    try {
      await api(`/listings/${id}/photo-order`, "POST", { ids });
      await load();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (fileId: string) => {
    if (!window.confirm("Remove this file?")) return;
    try {
      await api(`/files/${fileId}`, "DELETE");
      toast("Removed");
      await load();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  const editable = !["sold"].includes(l.status);
  const live = ["published", "under_offer"].includes(l.status);
  const hasTitle = data.papers.some((p) => p.kind === "title_document");

  return (
    <Page wide>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-faint hover:text-ink"
      >
        <Icon d={icons.arrow} className="size-3.5 rotate-180" />
        Dashboard
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-3xl">
          <Badge tone={statusTone[l.status]} live={l.status === "in_review"}>
            {LISTING_STATUS[l.status]}
          </Badge>
          <h1 className="mt-4 font-display text-4xl leading-tight text-ink sm:text-5xl">{l.title}</h1>
          <p className="mt-2 text-ink-soft">
            {l.town}
            {l.lga ? `, ${l.lga}` : ""}, {l.state} State
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/lands/${l.id}`} variant="secondary">
            <Icon d={icons.eye} className="size-4" />
            View as buyers see it
          </ButtonLink>
          {["draft", "rejected", "withdrawn"].includes(l.status) && (
            <Button variant="earth" busy={busy} onClick={() => status("in_review")}>
              Send for review
            </Button>
          )}
          {l.status === "in_review" && (
            <Button variant="secondary" busy={busy} onClick={() => status("draft")}>
              Back to draft
            </Button>
          )}
          {l.status === "published" && (
            <Button
              variant="ghost"
              busy={busy}
              onClick={() =>
                status("withdrawn", "Take this land off the market? Buyers in talks keep their deal rooms.")
              }
            >
              Withdraw
            </Button>
          )}
          {["draft", "rejected", "withdrawn"].includes(l.status) && (
            <Button
              variant="ghost"
              busy={busy}
              onClick={async () => {
                if (!window.confirm("Delete this listing and its files for good?")) return;
                setBusy(true);
                try {
                  await api(`/listings/${id}`, "DELETE");
                  toast("Listing deleted");
                  router.push("/dashboard");
                } catch (err) {
                  toast((err as Error).message, "error");
                  setBusy(false);
                }
              }}
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      {l.titleSearchedAt ? (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-forest-200 bg-forest-50/70 px-6 py-5 dark:border-forest-300">
          <TitleSearchSeal at={l.titleSearchedAt} />
          {l.titleSearchRef && <span className="font-mono text-xs text-ink-soft">Ref. {l.titleSearchRef}</span>}
        </div>
      ) : (
        l.status === "in_review" && (
          <div className="mt-8 flex items-start gap-4 rounded-3xl border border-amber-100 bg-amber-50 px-6 py-5 text-amber-800">
            <span className="mt-0.5 size-2 shrink-0 animate-pulse-dot rounded-full bg-amber-500" aria-hidden="true" />
            <p className="text-sm leading-relaxed">
              <strong>We are searching your title at the Enugu State Ministry of Lands.</strong> Once it checks out, we
              publish the listing and buyers can make offers. Changing the title or the location now restarts the
              search.
            </p>
          </div>
        )
      )}

      {l.status === "rejected" && l.reviewNote && (
        <div className="mt-8 rounded-3xl border border-red-100 bg-red-50 p-6 text-red-800">
          <p className="text-xs font-bold tracking-wider uppercase">What our reviewer asked</p>
          <p className="mt-2 text-lg">“{l.reviewNote}”</p>
        </div>
      )}

      {["draft", "rejected", "withdrawn"].includes(l.status) && (
        <Card className="mt-8">
          <Eyebrow>Before you send it for review</Eyebrow>
          <ul className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ["The facts of the land", true],
              ["At least one photo", data.photos.length > 0],
              ["Your title document", hasTitle],
            ].map(([label, done]) => (
              <li key={String(label)} className="flex items-center gap-3">
                <span
                  className={cx(
                    "grid size-7 place-items-center rounded-full",
                    done ? "bg-forest-600 text-white" : "border-2 border-dashed border-line-strong",
                  )}
                >
                  {done && <Icon d={icons.check} className="size-4" />}
                </span>
                <span className={done ? "text-ink" : "text-ink-soft"}>{label}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="font-display text-2xl text-ink">Photos</h2>
          <p className="mt-1 text-sm text-ink-soft">
            The first is the cover. Show the land, its beacons and the road to it.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {data.photos.map((p, i) => (
              <div key={p.id} className="group relative aspect-square overflow-hidden rounded-2xl bg-sunken">
                {/* biome-ignore lint/performance/noImgElement: signed storage URL. */}
                <img src={p.url} alt="" className="size-full object-cover" />
                {i === 0 && (
                  <span className="absolute top-2 left-2 rounded-full bg-earth-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                    Cover
                  </span>
                )}
                <div className="absolute inset-x-2 bottom-2 flex justify-between gap-1 opacity-0 transition group-hover:opacity-100 max-sm:opacity-100">
                  <div className="flex gap-1">
                    {i > 0 && (
                      <button
                        type="button"
                        onClick={() => move(i, i - 1)}
                        disabled={busy}
                        className="grid size-10 place-items-center rounded-full bg-white/90 text-sm font-bold text-forest-950 disabled:opacity-60"
                        aria-label="Move earlier"
                      >
                        ←
                      </button>
                    )}
                    {i < data.photos.length - 1 && (
                      <button
                        type="button"
                        onClick={() => move(i, i + 1)}
                        disabled={busy}
                        className="grid size-10 place-items-center rounded-full bg-white/90 text-sm font-bold text-forest-950 disabled:opacity-60"
                        aria-label="Move later"
                      >
                        →
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    className="h-10 rounded-full bg-white/90 px-3.5 text-xs font-bold text-red-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {data.photos.length === 0 && (
              <div className="col-span-2 aspect-[2/1] overflow-hidden rounded-2xl sm:col-span-3">
                <PlotArt seed={l.id} landUse={l.landUse} />
              </div>
            )}
          </div>
          <div className="mt-4">
            <UploadZone
              target={{ listingId: id }}
              kind="photo"
              accept="image/*"
              multiple
              label="Add photos"
              hint="JPEG, PNG or HEIC, up to 12 MB each"
              onDone={load}
            />
          </div>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">Papers</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Seen by our reviewers, and by buyers once they make an offer. Never public.
          </p>
          <ul className="mt-5 space-y-2">
            {data.papers.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
                <Icon d={icons.doc} className="text-earth-600" />
                <button
                  type="button"
                  onClick={() => openFile(p.id).catch((e) => toast(e.message, "error"))}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-semibold text-ink">{p.filename}</span>
                  <span className="text-xs text-ink-faint">{PAPER_LABEL[p.kind] ?? p.kind}</span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  className="text-xs font-semibold text-ink-faint hover:text-red-700"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <UploadZone
              target={{ listingId: id }}
              kind="title_document"
              accept="image/*,application/pdf"
              label="Title document"
              hint="Photo or PDF"
              onDone={load}
            />
            <UploadZone
              target={{ listingId: id }}
              kind="survey_plan"
              accept="image/*,application/pdf"
              label="Survey plan"
              hint="Photo or PDF"
              onDone={load}
            />
          </div>
        </section>
      </div>

      {editable && (
        <section className="mt-16">
          <div className="mb-8 flex items-center justify-between gap-4">
            <h2 className="font-display text-3xl text-ink">Details</h2>
            {editing ? (
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit details
              </Button>
            )}
          </div>
          {editing && (
            <ListingForm
              initial={l}
              locked={live}
              submitLabel="Save changes"
              onSubmit={async (input) => {
                const body: Record<string, unknown> = { ...input };
                if (live)
                  for (const k of ["state", "lga", "town", "sizeValue", "sizeUnit", "titleKind", "landUse"])
                    delete body[k];
                await api(`/listings/${id}`, "PATCH", body);
                toast("Saved");
                setEditing(false);
                await load();
              }}
            />
          )}
        </section>
      )}
    </Page>
  );
}
