"use client";

import { use, useEffect, useState } from "react";
import { PlotArt } from "@/components/plot-art";
import { Loading, Page } from "@/components/shell";
import { Button, ErrorText, Eyebrow, Field, Icon, Input, icons } from "@/components/ui";
import { api } from "@/lib/api";
import { formatKobo, formatMoment } from "@/lib/land";

type View = {
  witness: {
    id: string;
    side: "seller" | "buyer";
    fullName: string;
    signedAt: string | null;
    signedName: string | null;
    current: boolean;
  };
  deal: {
    id: string;
    stage: string;
    agreedKobo: number | null;
    agreementText: string | null;
    agreementHash: string | null;
  };
  listing: { title: string; town: string; state: string };
  seller: string;
  buyer: string;
};

export default function WitnessPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ signedName: "", address: "", occupation: "", consent: false });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [read, setRead] = useState(false);

  const load = () => api<View>(`/witness/${encodeURIComponent(token)}`).then(setView, (e) => setError(e.message));
  // biome-ignore lint/correctness/useExhaustiveDependencies: load once per token.
  useEffect(() => {
    load();
  }, [token]);

  if (error)
    return (
      <Page>
        <div className="mx-auto max-w-md py-16 text-center">
          <p className="font-display text-3xl text-ink">This link does not work</p>
          <p className="mt-3 text-ink-soft">{error}</p>
        </div>
      </Page>
    );
  if (!view) return <Loading />;

  const w = view.witness;
  const party = w.side === "seller" ? view.seller : view.buyer;
  const partyRole = w.side === "seller" ? "seller (the Vendor)" : "buyer (the Purchaser)";
  const ready = view.deal.stage === "agreement" && view.deal.agreementText;

  async function sign(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await api(`/witness/${encodeURIComponent(token)}/sign`, "POST", {
        ...f,
        agreementHash: view!.deal.agreementHash,
      });
      await load();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Eyebrow>You are a witness</Eyebrow>
          <h1 className="mt-4 font-display text-4xl leading-tight text-ink sm:text-5xl">
            {w.fullName.split(" ")[0]}, {party} has asked you to witness their signature.
          </h1>
          <div className="mt-8 overflow-hidden rounded-3xl border border-line bg-surface shadow-soft">
            <div className="aspect-[2/1]">
              <PlotArt seed={view.deal.id} />
            </div>
            <dl className="divide-y divide-line text-sm">
              {[
                ["Land", `${view.listing.title}, ${view.listing.town}, ${view.listing.state}`],
                ["Seller", view.seller],
                ["Buyer", view.buyer],
                ["Price", formatKobo(view.deal.agreedKobo)],
                ["You witness", `${party}, the ${partyRole}`],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-4 px-5 py-3">
                  <dt className="w-24 shrink-0 text-ink-faint">{k}</dt>
                  <dd className="text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="mt-6 rounded-3xl bg-sunken p-5 text-sm leading-relaxed text-ink-soft">
            <p className="font-semibold text-ink">What a witness does</p>
            <p className="mt-2">
              By signing, you confirm that you know {party}, and that they are signing this agreement as themselves, of
              their own free will. You are not guaranteeing the land or the price. If you do not know {party}, do not
              sign.
            </p>
          </div>
        </div>

        <div>
          {w.current ? (
            <div className="deep-ground rounded-[2rem] p-10 text-white">
              <span className="grid size-14 place-items-center rounded-full bg-brass-300 text-forest-950">
                <Icon d={icons.check} className="size-7" />
              </span>
              <h2 className="mt-6 font-display text-4xl">Thank you. You have signed.</h2>
              <p className="mt-3 font-display text-2xl text-brass-300 italic">{w.signedName}</p>
              <p className="mt-1 text-white/60">{formatMoment(w.signedAt)}</p>
              <p className="mt-6 text-white/70">
                Your signature is recorded with the agreement. You can close this page.
              </p>
            </div>
          ) : !ready ? (
            <div className="rounded-3xl border border-line bg-surface p-8">
              <p className="font-display text-2xl text-ink">The agreement is not ready yet</p>
              <p className="mt-2 text-ink-soft">
                {view.deal.stage === "checks"
                  ? "The buyer and seller are still settling the terms. Keep this link; open it again when they tell you the agreement is ready."
                  : "This agreement is not open for signing."}
              </p>
              {w.signedAt && (
                <p className="mt-3 text-sm text-earth-700">
                  You signed an earlier version, but the terms changed since. You will need to sign again.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-[2rem] border border-line bg-surface shadow-soft">
                <p className="border-b border-line px-7 py-4 font-display text-xl text-ink">Read the agreement</p>
                <div
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) setRead(true);
                  }}
                  className="survey-grid max-h-[480px] overflow-y-auto px-7 py-8"
                >
                  <div className="agreement">{view.deal.agreementText}</div>
                </div>
              </div>
              <form
                onSubmit={sign}
                className="mt-6 space-y-5 rounded-[2rem] border border-line bg-surface p-7 shadow-soft"
              >
                {!read && <p className="text-sm text-earth-700">Scroll to the end of the agreement to sign.</p>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Your address">
                    <Input required value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
                  </Field>
                  <Field label="Your occupation">
                    <Input required value={f.occupation} onChange={(e) => setF({ ...f, occupation: e.target.value })} />
                  </Field>
                </div>
                <Field label={`Type your full name to sign: ${w.fullName}`}>
                  <Input
                    required
                    disabled={!read}
                    value={f.signedName}
                    onChange={(e) => setF({ ...f, signedName: e.target.value })}
                    className="h-14 font-display text-2xl italic"
                  />
                </Field>
                <label className="flex items-start gap-3 text-sm text-ink-soft">
                  <input
                    type="checkbox"
                    disabled={!read}
                    checked={f.consent}
                    onChange={(e) => setF({ ...f, consent: e.target.checked })}
                    className="mt-0.5 size-5 accent-[oklch(0.6_0.15_40)]"
                  />
                  I know {party} and witness their signature to this agreement. Typing my name is my electronic
                  signature.
                </label>
                <ErrorText error={formError} />
                <Button type="submit" variant="earth" size="lg" busy={busy} disabled={!read || !f.consent}>
                  <Icon d={icons.pen} className="size-4" />
                  Sign as witness
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </Page>
  );
}
