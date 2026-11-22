"use client";

import { useState } from "react";
import type { Listing } from "@/lib/api";
import {
  FEATURES,
  formatKobo,
  HOME_LGAS,
  HOME_STATE,
  LAND_USE,
  nairaToKobo,
  SERVED,
  SERVED_STATES,
  TITLE_LABEL,
  TITLE_STRENGTH,
} from "@/lib/land";
import { TitleBars } from "./listing-card";
import { Button, cx, ErrorText, Field, Input, Select, Textarea } from "./ui";

export type ListingInput = {
  title: string;
  description: string;
  state: string;
  lga: string;
  town: string;
  addressLine: string;
  sizeValue: number;
  sizeUnit: string;
  priceKobo: number;
  negotiable: boolean;
  landUse: string;
  titleKind: string;
  titleReference: string;
  features: string[];
  latitude: number | null;
  longitude: number | null;
};

function Section({ n, title, hint, children }: { n: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-t border-line py-10 first:border-t-0 first:pt-0 lg:grid-cols-[260px_1fr]">
      <div>
        <p className="font-mono text-xs text-earth-600">{n}</p>
        <h2 className="mt-1 font-display text-2xl text-ink">{title}</h2>
        {hint && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{hint}</p>}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

/** The facts of a piece of land: for a new listing, and to edit one. */
export function ListingForm({
  initial,
  locked,
  submitLabel,
  onSubmit,
}: {
  initial?: Listing;
  /** On the market: location, size, use and title are fixed (they were reviewed). */
  locked?: boolean;
  submitLabel: string;
  onSubmit: (input: ListingInput) => Promise<void>;
}) {
  const [f, setF] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    state: initial?.state ?? HOME_STATE,
    lga: initial?.lga ?? "",
    town: initial?.town ?? "",
    addressLine: initial?.addressLine ?? "",
    sizeValue: initial ? String(initial.sizeValue) : "",
    sizeUnit: initial?.sizeUnit ?? "plot",
    price: initial ? String(initial.priceKobo / 100) : "",
    negotiable: initial?.negotiable ?? true,
    landUse: initial?.landUse ?? "residential",
    titleKind: initial?.titleKind ?? "",
    titleReference: initial?.titleReference ?? "",
    features: initial?.features ?? [],
    latitude: initial?.latitude != null ? String(initial.latitude) : "",
    longitude: initial?.longitude != null ? String(initial.longitude) : "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set =
    (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setF({ ...f, [k]: e.target.value });
  const kobo = nairaToKobo(f.price);

  const locate = () => {
    if (!navigator.geolocation) return setError("This browser cannot share its location.");
    navigator.geolocation.getCurrentPosition(
      (p) => setF((x) => ({ ...x, latitude: p.coords.latitude.toFixed(6), longitude: p.coords.longitude.toFixed(6) })),
      () => setError("Could not read your location. Allow location for this site, or type the coordinates."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!kobo) return setError("Enter the price in naira, e.g. 15,000,000 or 15m.");
    if (!f.titleKind) return setError("Choose the document of title you hold.");
    // Number("2 plots") is NaN, which goes over the wire as null: say so here instead.
    const size = Number(f.sizeValue);
    if (!Number.isFinite(size) || size <= 0) return setError("Enter the size as a number, e.g. 2 or 650.");
    const lat = f.latitude ? Number(f.latitude) : null;
    const lng = f.longitude ? Number(f.longitude) : null;
    if ((lat !== null && !(Math.abs(lat) <= 90)) || (lng !== null && !(Math.abs(lng) <= 180)))
      return setError("The map position is not a valid latitude and longitude. Use the button, or leave both empty.");
    if ((lat === null) !== (lng === null)) return setError("Give both the latitude and the longitude, or neither.");
    setBusy(true);
    try {
      await onSubmit({
        title: f.title,
        description: f.description,
        state: f.state,
        lga: f.lga,
        town: f.town,
        addressLine: f.addressLine,
        sizeValue: Number(f.sizeValue),
        sizeUnit: f.sizeUnit,
        priceKobo: kobo,
        negotiable: f.negotiable,
        landUse: f.landUse,
        titleKind: f.titleKind,
        titleReference: f.titleReference,
        features: f.features,
        latitude: f.latitude ? Number(f.latitude) : null,
        longitude: f.longitude ? Number(f.longitude) : null,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <Section
        n="01"
        title="Where is it?"
        hint="The town and area are public. The exact address is shown only to buyers you are in a deal with."
      >
        {locked && (
          <p className="rounded-2xl bg-sunken px-4 py-3 text-sm text-ink-soft">
            Location, size, use and title were checked when the listing was reviewed. To change them, withdraw the
            listing and send it for review again.
          </p>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="State"
            hint={SERVED_STATES.length === 1 ? "For now, DesMind Lands lists land in Enugu State only." : undefined}
          >
            <Select
              required
              disabled={locked || SERVED_STATES.length === 1}
              value={f.state}
              onChange={(e) => setF({ ...f, state: e.target.value, lga: "" })}
            >
              {SERVED_STATES.map((s) => (
                <option key={s} value={s}>
                  {s} State
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Local government area">
            <Select required disabled={locked} value={f.lga} onChange={set("lga")}>
              <option value="">Choose…</option>
              {(SERVED[f.state] ?? HOME_LGAS).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Town or area">
          <Input required disabled={locked} value={f.town} onChange={set("town")} placeholder="e.g. Emene" />
        </Field>
        <Field label="Address or layout (private)" hint="Street, layout or estate, and plot number.">
          <Input value={f.addressLine} onChange={set("addressLine")} placeholder="Plot 14, Umuchigbo layout" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Latitude (optional)">
            <Input inputMode="decimal" value={f.latitude} onChange={set("latitude")} placeholder="6.4584" />
          </Field>
          <Field label="Longitude (optional)">
            <Input inputMode="decimal" value={f.longitude} onChange={set("longitude")} placeholder="7.5464" />
          </Field>
          <Button type="button" variant="secondary" onClick={locate} className="h-[50px]">
            I am on the land
          </Button>
        </div>
      </Section>

      <Section n="02" title="The land" hint="A clear title helps buyers find you. Say what is true; buyers will visit.">
        <Field label="Title of the listing">
          <Input
            required
            minLength={6}
            value={f.title}
            onChange={set("title")}
            placeholder="Two dry plots off the airport road, Emene"
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-[1fr_1fr_1fr]">
          <Field label="Size">
            <Input
              required
              disabled={locked}
              inputMode="decimal"
              value={f.sizeValue}
              onChange={set("sizeValue")}
              placeholder="2"
            />
          </Field>
          <Field label="Unit">
            <Select disabled={locked} value={f.sizeUnit} onChange={set("sizeUnit")}>
              <option value="plot">Plots</option>
              <option value="sqm">Square metres</option>
              <option value="acre">Acres</option>
              <option value="hectare">Hectares</option>
            </Select>
          </Field>
          <Field label="Use">
            <Select disabled={locked} value={f.landUse} onChange={set("landUse")}>
              {Object.entries(LAND_USE).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Description">
          <Textarea
            value={f.description}
            onChange={set("description")}
            className="min-h-36"
            placeholder="The land, the neighbourhood, the road to it, what is nearby, and anything a buyer should know."
          />
        </Field>
        <div>
          <p className="mb-3 text-[13px] font-semibold text-ink-soft">Tick what is true</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(FEATURES).map(([k, v]) => {
              const on = f.features.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setF({ ...f, features: on ? f.features.filter((x) => x !== k) : [...f.features, k] })}
                  className={cx(
                    "rounded-full border px-4 py-2 text-sm font-medium transition",
                    on
                      ? "border-primary bg-primary text-on-primary"
                      : "border-line-strong text-ink-soft hover:border-ink-faint",
                  )}
                >
                  {on && "✓ "}
                  {v}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      <Section
        n="03"
        title="Title"
        hint="The document that proves you own the land. You upload it after saving; our staff review it."
      >
        <div role="radiogroup" aria-label="Document of title" className="grid gap-3 sm:grid-cols-2">
          {Object.entries(TITLE_LABEL).map(([k, v]) => (
            // biome-ignore lint/a11y/useSemanticElements: a card with a title, bars and a note, chosen like a radio.
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={f.titleKind === k}
              disabled={locked}
              onClick={() => setF({ ...f, titleKind: k })}
              className={cx(
                "flex items-start gap-3 rounded-2xl border p-4 text-left transition disabled:opacity-60",
                f.titleKind === k
                  ? "border-earth-500 bg-earth-50 ring-2 ring-earth-200"
                  : "border-line-strong bg-surface hover:border-ink-faint",
              )}
            >
              <span className="mt-1">
                <TitleBars kind={k} />
              </span>
              <span>
                <span className="block font-semibold text-ink">{v}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-faint">{TITLE_STRENGTH[k]?.note}</span>
              </span>
            </button>
          ))}
        </div>
        <Field
          label="Reference number (optional, private)"
          hint="e.g. the C of O or survey plan number. Shown only to buyers in a deal."
        >
          <Input value={f.titleReference} onChange={set("titleReference")} />
        </Field>
      </Section>

      <Section n="04" title="Price" hint="The whole price is yours. No commission is taken by anyone.">
        <Field
          label="Asking price (₦)"
          hint={kobo ? <strong className="text-ink-soft">{formatKobo(kobo)}</strong> : "e.g. 15,000,000 or 15m"}
        >
          <Input
            required
            inputMode="decimal"
            value={f.price}
            onChange={set("price")}
            className="h-16 font-display text-3xl"
          />
        </Field>
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
          <input
            type="checkbox"
            checked={f.negotiable}
            onChange={(e) => setF({ ...f, negotiable: e.target.checked })}
            className="size-5 accent-accent"
          />
          <span>
            <span className="block font-semibold text-ink">Open to offers</span>
            <span className="text-sm text-ink-soft">Untick to accept only the asking price.</span>
          </span>
        </label>
      </Section>

      <div className="sticky bottom-0 z-20 -mx-4 mt-4 border-t border-line bg-canvas/90 px-4 py-4 backdrop-blur-xl sm:mx-0 sm:rounded-full sm:border sm:px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <ErrorText error={error} />
          </div>
          <Button type="submit" size="lg" busy={busy}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
