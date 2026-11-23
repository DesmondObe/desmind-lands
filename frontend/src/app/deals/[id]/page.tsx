"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
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
  Field,
  Icon,
  Input,
  icons,
  Select,
  statusTone,
  Textarea,
} from "@/components/ui";
import { UploadZone } from "@/components/uploads";
import { ApiError, api, type DealStage, type Listing, openFile, type Side } from "@/lib/api";
import {
  formatDay,
  formatKobo,
  formatMoment,
  formatSize,
  nairaToKobo,
  STAGE_LABEL,
  STAGES,
  TITLE_LABEL,
  timeAgo,
} from "@/lib/land";

type Person = { id: string; fullName: string; email: string; phone: string };
type Offer = { id: string; authorId: string; amountKobo: number; note: string; status: string; createdAt: string };
type Witness = {
  id: string;
  side: Side;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  occupation: string;
  signedName: string | null;
  signedAt: string | null;
  current: boolean;
};
type Payment = {
  id: string;
  amountKobo: number;
  method: string;
  reference: string;
  paidOn: string;
  note: string;
  proofFileId: string | null;
  status: "submitted" | "confirmed" | "disputed";
  responseNote: string;
  createdAt: string;
};
type Room = {
  deal: {
    id: string;
    stage: DealStage;
    agreedKobo: number | null;
    inspectionAt: string | null;
    inspectionNote: string;
    checklist: Record<string, boolean>;
    bankName: string;
    bankAccountNumber: string;
    bankAccountName: string;
    completionDate: string | null;
    specialTerms: string;
    agreementText: string | null;
    agreementHash: string | null;
    paidAt: string | null;
    sellerHandoverAt: string | null;
    buyerReceivedAt: string | null;
    completedAt: string | null;
    cancelledAt: string | null;
    cancelReason: string;
    createdAt: string;
  };
  role: Side | "admin";
  listing: Listing;
  coverUrl: string | null;
  seller: Person;
  buyer: Person;
  offers: Offer[];
  messages: { id: string; authorId: string; body: string; createdAt: string }[];
  witnesses: Witness[];
  signatures: { party: Side; signedName: string; signedAt: string; current: boolean }[];
  payments: Payment[];
  files: { id: string; kind: string; filename: string; uploadedBy: string; createdAt: string }[];
  listingPapers: { id: string; kind: string; filename: string }[];
  events: { id: string; actorLabel: string; kind: string; summary: string; createdAt: string }[];
  checks: { key: string; label: string }[];
  confirmedKobo: number;
  nextStep: { who: Side | "both" | null; text: string; yours: boolean };
};

type Ctx = { room: Room; reload: () => Promise<void>; me: Side };

/** Runs an action, says what happened, and reloads the room. */
function useAct(reload: () => Promise<void>) {
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (key: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    try {
      await fn();
      if (done) toast(done);
      await reload();
      return true;
    } catch (err) {
      toast((err as Error).message, "error");
      return false;
    } finally {
      setBusy(null);
    }
  };
  return { busy, act };
}

export default function DealRoom({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me } = useRequireSignIn();
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<{ message: string; gone: boolean } | null>(null);
  const [offline, setOffline] = useState(false);
  const opened = useRef(false);

  const reload = useCallback(async () => {
    try {
      setRoom(await api<Room>(`/deals/${id}`));
      opened.current = true;
      setOffline(false);
      setError(null);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const gone = status === 403 || status === 404;
      // Once the room is open, a dropped connection or a slow server is not the end of the
      // deal: keep what is on screen, say so, and let the next look (20 s) put it right.
      if (opened.current && !gone && status !== 401) setOffline(true);
      else setError({ message: (err as Error).message, gone });
    }
  }, [id]);
  useEffect(() => {
    if (me) void reload();
  }, [me, reload]);
  // The other party acts too: look again every 20 seconds while the tab is open.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, 20_000);
    return () => clearInterval(t);
  }, [reload]);

  if (error)
    return (
      <Page>
        <div className="mx-auto max-w-md py-16 text-center">
          <p className="font-display text-3xl">{error.gone ? "Deal not found" : "The deal room did not open"}</p>
          <p className="mt-3 text-ink-soft">{error.message}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {!error.gone && (
              <Button
                onClick={() => {
                  setError(null);
                  void reload();
                }}
              >
                Try again
              </Button>
            )}
            <ButtonLink href="/dashboard" variant={error.gone ? "primary" : "secondary"}>
              Back to the dashboard
            </ButtonLink>
          </div>
        </div>
      </Page>
    );
  if (!room) return <Loading label="Opening the deal room" />;

  const side: Side = room.role === "admin" ? "seller" : room.role;
  const ctx: Ctx = { room, reload, me: side };
  const d = room.deal;
  const stageIdx = STAGES.findIndex((s) => s.key === d.stage);
  const other = side === "seller" ? room.buyer : room.seller;
  const stageView = (
    <>
      {d.stage === "negotiating" && <Negotiation {...ctx} />}
      {d.stage === "checks" && <Checks {...ctx} />}
      {d.stage === "agreement" && <Agreement {...ctx} />}
      {d.stage === "payment" && <PaymentStage {...ctx} />}
    </>
  );

  return (
    <>
      {/* Header */}
      <section className="deep-ground relative overflow-hidden text-white">
        <div className="survey-grid absolute inset-0 [--grid-line:oklch(1_0_0/0.04)]" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-4 pt-28 pb-10 sm:px-6 sm:pt-32">
          <Link href="/dashboard" className="text-sm text-white/60 hover:text-white">
            ← Dashboard
          </Link>
          <div className="mt-5 flex flex-wrap items-start gap-6">
            <div className="hidden size-24 shrink-0 overflow-hidden rounded-3xl ring-1 ring-white/20 sm:block">
              {room.coverUrl ? (
                // biome-ignore lint/performance/noImgElement: signed storage URL.
                <img src={room.coverUrl} alt="" className="size-full object-cover" />
              ) : (
                <PlotArt seed={room.listing.id} landUse={room.listing.landUse} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold tracking-[0.2em] text-brass-300 uppercase">
                Deal room · you are the {room.role}
              </p>
              <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">
                <Link href={`/lands/${room.listing.id}`} className="hover:underline">
                  {room.listing.title}
                </Link>
              </h1>
              <p className="mt-2 text-white/65">
                {room.listing.town}, {room.listing.state} · {formatSize(room.listing.sizeValue, room.listing.sizeUnit)}{" "}
                · {TITLE_LABEL[room.listing.titleKind]}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/55">{d.agreedKobo ? "Agreed price" : "Asking price"}</p>
              <p className="font-display text-4xl text-brass-300">
                {formatKobo(d.agreedKobo ?? room.listing.priceKobo)}
              </p>
            </div>
          </div>

          {/* Stage tracker */}
          {d.stage !== "cancelled" ? (
            <ol className="mt-10 grid grid-cols-5 gap-2">
              {STAGES.map((s, i) => {
                const done = i < stageIdx || d.stage === "completed";
                const now = i === stageIdx && d.stage !== "completed";
                return (
                  <li key={s.key} aria-current={now ? "step" : undefined}>
                    <div
                      className={cx(
                        "h-1.5 rounded-full",
                        done ? "bg-brass-300" : now ? "bg-gradient-to-r from-brass-300 to-white/20" : "bg-white/15",
                      )}
                    />
                    <p className={cx("mt-3 text-[13px] font-semibold", done || now ? "text-white" : "text-white/40")}>
                      <span className="hidden sm:inline">{s.long}</span>
                      <span className="sm:hidden">{s.label}</span>
                      <span className="sr-only">{done ? " (done)" : now ? " (current step)" : " (to come)"}</span>
                    </p>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-8 inline-flex rounded-full bg-white/10 px-4 py-2 text-sm">
              Cancelled {formatDay(d.cancelledAt)}: “{d.cancelReason}”
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        {offline && (
          <p
            role="status"
            className="mb-4 flex items-center gap-2.5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          >
            <span className="size-2 shrink-0 animate-pulse-dot rounded-full bg-amber-500" aria-hidden="true" />
            Connection lost. What you see may be a little out of date; reconnecting…
          </p>
        )}
        {room.nextStep.text && (
          <div
            className={cx(
              "flex animate-rise items-center gap-4 rounded-3xl px-6 py-5",
              room.nextStep.yours ? "bg-accent text-on-accent" : "border border-line bg-surface text-ink-soft",
            )}
          >
            <span
              className={cx(
                "grid size-10 shrink-0 place-items-center rounded-full",
                room.nextStep.yours ? "bg-on-accent/15" : "bg-sunken",
              )}
            >
              <Icon d={room.nextStep.yours ? icons.pen : icons.calendar} />
            </span>
            <p className="text-[15px]">
              <strong className="font-semibold">{room.nextStep.yours ? "Your move. " : "Waiting. "}</strong>
              {room.role === "admin"
                ? room.nextStep.text
                : room.nextStep.text
                    .replace(`the ${side} to sign`, "you to sign")
                    .replace(`for the ${side}`, "for you")}
            </p>
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="min-w-0 space-y-8">
            {room.role === "admin" ? (
              // Staff see the room as the seller does, but the deal is not theirs to move: a
              // disabled fieldset switches off every button and field inside it at once.
              <fieldset disabled className="m-0 min-w-0 space-y-8 border-0 p-0">
                <p className="rounded-2xl border border-line bg-sunken px-4 py-3 text-sm text-ink-soft">
                  <strong className="font-semibold text-ink">Staff view.</strong> You can read this deal, its papers and
                  its record. Only the seller and the buyer can act in it.
                </p>
                {stageView}
              </fieldset>
            ) : (
              stageView
            )}
            {d.stage === "completed" && <Completed {...ctx} />}
            {d.stage === "cancelled" && (
              <Card>
                <p className="font-display text-2xl text-ink">This deal was cancelled.</p>
                <p className="mt-2 text-ink-soft">{d.cancelReason}</p>
                <ButtonLink href="/lands" className="mt-6">
                  Browse other land
                </ButtonLink>
              </Card>
            )}
            {["agreement", "payment", "completed"].includes(d.stage) && d.agreementText && d.stage !== "agreement" && (
              <AgreementText room={room} collapsed />
            )}
            <Timeline room={room} />
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <Card className="p-5">
              <p className="text-xs font-bold tracking-wider text-ink-faint uppercase">
                The {side === "seller" ? "buyer" : "seller"}
              </p>
              <p className="mt-1 font-display text-2xl text-ink">{other.fullName}</p>
              <div className="mt-3 space-y-1 text-sm">
                <a href={`mailto:${other.email}`} className="block text-ink-soft hover:text-ink">
                  {other.email}
                </a>
                {other.phone && (
                  <a href={`tel:+${other.phone}`} className="block text-ink-soft hover:text-ink">
                    +{other.phone}
                  </a>
                )}
              </div>
              {other.phone && (
                <a
                  href={`https://wa.me/${other.phone}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-forest-700"
                >
                  <Icon d={icons.chat} className="size-4" />
                  WhatsApp
                </a>
              )}
            </Card>
            <Conversation {...ctx} />
            <Documents {...ctx} />
            {!["completed", "cancelled"].includes(d.stage) && !d.paidAt && room.role !== "admin" && (
              <CancelDeal {...ctx} />
            )}
          </aside>
        </div>
      </div>
    </>
  );
}

// --- Negotiation ---------------------------------------------------------------------------

function Negotiation({ room, reload, me }: Ctx) {
  const { busy, act } = useAct(reload);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const open = room.offers.find((o) => o.status === "open");
  const myId = me === "seller" ? room.seller.id : room.buyer.id;
  const openIsMine = open?.authorId === myId;
  const kobo = nairaToKobo(amount);
  const nameOf = (id: string) => (id === room.seller.id ? room.seller.fullName : room.buyer.fullName);

  return (
    <Card className="p-0">
      <div className="p-7">
        <Eyebrow>Agree a price</Eyebrow>
        {open ? (
          <div className="mt-6 rounded-3xl bg-sunken p-6">
            <p className="text-sm text-ink-soft">
              {openIsMine ? "Your offer" : `${nameOf(open.authorId)} offers`} · {timeAgo(open.createdAt)}
            </p>
            <p className="mt-1 font-display text-5xl text-ink">{formatKobo(open.amountKobo)}</p>
            {open.amountKobo !== room.listing.priceKobo && (
              <p className="mt-1 text-sm text-ink-faint">
                {open.amountKobo < room.listing.priceKobo ? "Below" : "Above"} the asking price of{" "}
                {formatKobo(room.listing.priceKobo)} by {formatKobo(Math.abs(room.listing.priceKobo - open.amountKobo))}
              </p>
            )}
            {open.note && <p className="mt-4 border-l-2 border-earth-400 pl-4 text-ink-soft italic">“{open.note}”</p>}
            <div className="mt-6 flex flex-wrap gap-2">
              {openIsMine ? (
                <Button
                  variant="secondary"
                  busy={busy === "withdraw"}
                  onClick={() => {
                    if (window.confirm(`Withdraw your offer of ${formatKobo(open.amountKobo)}?`))
                      void act(
                        "withdraw",
                        () => api(`/deals/${room.deal.id}/offers/${open.id}/withdraw`, "POST"),
                        "Offer withdrawn",
                      );
                  }}
                >
                  Withdraw my offer
                </Button>
              ) : (
                <>
                  <Button
                    variant="earth"
                    busy={busy === "accept"}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Accept ${formatKobo(open.amountKobo)}? The land goes under offer to ${me === "seller" ? "this buyer" : "you"}, and other buyers' offers wait.`,
                        )
                      )
                        void act(
                          "accept",
                          () => api(`/deals/${room.deal.id}/offers/${open.id}/accept`, "POST"),
                          "Accepted. On to the checks.",
                        );
                    }}
                  >
                    Accept {formatKobo(open.amountKobo)}
                  </Button>
                  <Button
                    variant="secondary"
                    busy={busy === "decline"}
                    onClick={() => {
                      if (window.confirm(`Decline the offer of ${formatKobo(open.amountKobo)}?`))
                        void act(
                          "decline",
                          () => api(`/deals/${room.deal.id}/offers/${open.id}/decline`, "POST"),
                          "Declined",
                        );
                    }}
                  >
                    Decline
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4">
            {room.listing.negotiable ? (
              <p className="text-ink-soft">No offer is on the table. Make one below.</p>
            ) : (
              <>
                <p className="text-ink-soft">
                  No offer is on the table. The seller has fixed the price at{" "}
                  <strong className="text-ink">{formatKobo(room.listing.priceKobo)}</strong>.
                </p>
                {room.role === "buyer" && (
                  <Button
                    className="mt-4"
                    busy={busy === "counter"}
                    onClick={() =>
                      act(
                        "counter",
                        () =>
                          api(`/deals/${room.deal.id}/offers`, "POST", {
                            amountKobo: room.listing.priceKobo,
                            note: "",
                          }),
                        "Offer sent",
                      )
                    }
                  >
                    Offer the asking price
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        {room.listing.negotiable && (
          <form
            className="mt-8 grid gap-4 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!kobo) return toast("Enter an amount in naira.", "error");
              if (
                await act(
                  "counter",
                  () => api(`/deals/${room.deal.id}/offers`, "POST", { amountKobo: kobo, note }),
                  "Offer sent",
                )
              ) {
                setAmount("");
                setNote("");
              }
            }}
          >
            <Field
              label={open && !openIsMine ? "Counter-offer (₦)" : "New offer (₦)"}
              hint={kobo ? formatKobo(kobo) : undefined}
            >
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 13.5m"
              />
            </Field>
            <Field label="Note (optional)" hint={kobo ? " " : undefined}>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <Button type="submit" busy={busy === "counter"} className="h-[50px]">
              Send
            </Button>
          </form>
        )}
      </div>

      {room.offers.length > 0 && (
        <div className="border-t border-line px-7 py-5">
          <p className="mb-3 text-xs font-bold tracking-wider text-ink-faint uppercase">Offer history</p>
          <ul className="space-y-2 text-sm">
            {[...room.offers].reverse().map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-4">
                <span className="text-ink-soft">
                  {nameOf(o.authorId)} · {timeAgo(o.createdAt)}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold text-ink tabular-nums">{formatKobo(o.amountKobo)}</span>
                  <span className="w-20 text-right text-xs text-ink-faint capitalize">{o.status}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

// --- Checks --------------------------------------------------------------------------------

/**
 * A form over values that live on the server and may change under it. Only what the user has
 * typed is kept here; every other field shows the server's latest. Without this, a form copied
 * once at mount goes stale, and saving it writes old values over the other party's new ones.
 */
function useDraft<T extends Record<string, string>>(saved: T) {
  const [typed, setTyped] = useState<Partial<T>>({});
  const value = { ...saved, ...typed } as T;
  const set = (next: T) => {
    const changed: Partial<T> = {};
    for (const k of Object.keys(next) as (keyof T)[]) if (next[k] !== saved[k]) changed[k] = next[k];
    setTyped(changed);
  };
  /** After a save: these fields are the server's again. */
  const clear = (...keys: (keyof T)[]) =>
    setTyped((t) => {
      const rest = { ...t };
      for (const k of keys) delete rest[k];
      return rest;
    });
  return [value, set, clear] as const;
}

function Checks({ room, reload, me }: Ctx) {
  const { busy, act } = useAct(reload);
  const d = room.deal;
  const patch = (key: string, body: object, done = "Saved") =>
    act(key, () => api(`/deals/${d.id}/terms`, "PATCH", body), done);
  // The room is looked at again every 20 seconds, and the other party edits these too. A field
  // you have not touched follows what is saved; one you have typed in keeps what you typed.
  const [bank, setBank, bankSaved] = useDraft({
    bankName: d.bankName,
    bankAccountNumber: d.bankAccountNumber,
    bankAccountName: d.bankAccountName,
  });
  const [terms, setTerms, termsSaved] = useDraft({
    completionDate: d.completionDate ?? "",
    specialTerms: d.specialTerms,
    inspectionAt: d.inspectionAt ? toLocalInput(d.inspectionAt) : "",
    inspectionNote: d.inspectionNote,
  });
  const ticked = room.checks.filter((c) => d.checklist[c.key]).length;

  return (
    <>
      <Card>
        <Eyebrow>Inspect and verify</Eyebrow>
        <h2 className="mt-4 font-display text-3xl text-ink">Agreed at {formatKobo(d.agreedKobo)}. Now, the checks.</h2>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Nothing is binding yet. The buyer visits the land and verifies the title; both of you settle the terms the
          agreement will carry.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl bg-sunken p-5">
            <p className="flex items-center gap-2 font-semibold text-ink">
              <Icon d={icons.calendar} className="text-earth-600" />
              Inspection
            </p>
            <div className="mt-4 space-y-3">
              <Input
                type="datetime-local"
                aria-label="Inspection date and time"
                value={terms.inspectionAt}
                onChange={(e) => setTerms({ ...terms, inspectionAt: e.target.value })}
              />
              <Input
                placeholder="Where to meet, who comes"
                aria-label="Where to meet, and who comes"
                value={terms.inspectionNote}
                onChange={(e) => setTerms({ ...terms, inspectionNote: e.target.value })}
              />
              <Button
                size="sm"
                variant="secondary"
                busy={busy === "inspect"}
                onClick={() =>
                  patch(
                    "inspect",
                    {
                      inspectionAt: terms.inspectionAt ? new Date(terms.inspectionAt).toISOString() : null,
                      inspectionNote: terms.inspectionNote,
                    },
                    "Inspection saved",
                  ).then((ok) => ok && termsSaved("inspectionAt", "inspectionNote"))
                }
              >
                Save inspection
              </Button>
            </div>
          </div>

          <div className="rounded-3xl bg-sunken p-5">
            <p className="flex items-center gap-2 font-semibold text-ink">
              <Icon d={icons.doc} className="text-earth-600" />
              The seller's papers
            </p>
            {room.listingPapers.length ? (
              <ul className="mt-4 space-y-2">
                {room.listingPapers.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => openFile(p.id).catch((e) => toast(e.message, "error"))}
                      className="flex w-full items-center gap-2 rounded-xl bg-surface px-3 py-2 text-left text-sm hover:bg-forest-50"
                    >
                      <span className="flex-1 truncate">{p.filename}</span>
                      <span className="text-xs text-ink-faint">{p.kind === "survey_plan" ? "Survey" : "Title"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-ink-soft">
                No papers uploaded on the listing. Ask the seller to add them.
              </p>
            )}
            <p className="mt-3 text-xs text-ink-faint">
              Address: {room.listing.addressLine || "ask the seller"}
              {room.listing.titleReference && ` · Ref. ${room.listing.titleReference}`}
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h3 className="font-display text-2xl text-ink">The buyer's checks</h3>
            <p className="mt-1 text-sm text-ink-soft">
              {me === "buyer"
                ? "Tick each one as you do it. Visiting the land is required."
                : "The buyer ticks these as they go."}
            </p>
          </div>
          <span className="font-display text-3xl text-earth-600">
            {ticked}/{room.checks.length}
          </span>
        </div>
        <ul className="mt-6 space-y-2">
          {room.checks.map((c) => {
            const on = !!d.checklist[c.key];
            return (
              <li key={c.key}>
                <button
                  type="button"
                  disabled={me !== "buyer" || busy === c.key}
                  aria-pressed={on}
                  onClick={() => patch(c.key, { checklist: { [c.key]: !on } }, on ? "Unticked" : "Ticked")}
                  className={cx(
                    "flex w-full items-center gap-4 rounded-2xl border px-4 py-3.5 text-left transition",
                    on ? "border-forest-300 bg-forest-50" : "border-line bg-surface",
                    me === "buyer" && "hover:border-forest-500",
                  )}
                >
                  <span
                    className={cx(
                      "grid size-7 shrink-0 place-items-center rounded-lg border-2",
                      on ? "border-primary bg-primary text-on-primary" : "border-line-strong",
                    )}
                  >
                    {on && <Icon d={icons.check} className="size-4" />}
                  </span>
                  <span className={on ? "text-ink" : "text-ink-soft"}>{c.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-ink-faint">
          DesMind Lands searched this title at the Ministry of Lands before listing; the reference is on the listing. A
          search is not a guarantee: a surveyor&apos;s charting and your own lawyer are the surest ways to avoid land
          under government acquisition or sold twice.
        </p>
      </Card>

      <Card>
        <h3 className="font-display text-2xl text-ink">Payment account</h3>
        {me === "seller" ? (
          <>
            <p className="mt-1 text-sm text-ink-soft">
              The account in your own name that the buyer will pay into. It goes into the agreement.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Field label="Bank">
                <Input
                  value={bank.bankName}
                  onChange={(e) => setBank({ ...bank, bankName: e.target.value })}
                  placeholder="Zenith Bank"
                />
              </Field>
              <Field label="Account number">
                <Input
                  inputMode="numeric"
                  maxLength={10}
                  value={bank.bankAccountNumber}
                  onChange={(e) => setBank({ ...bank, bankAccountNumber: e.target.value.replace(/\D/g, "") })}
                />
              </Field>
              <Field label="Account name">
                <Input
                  value={bank.bankAccountName}
                  onChange={(e) => setBank({ ...bank, bankAccountName: e.target.value })}
                />
              </Field>
            </div>
            <Button
              className="mt-4"
              size="sm"
              busy={busy === "bank"}
              onClick={() =>
                patch("bank", bank, "Account saved").then(
                  (ok) => ok && bankSaved("bankName", "bankAccountNumber", "bankAccountName"),
                )
              }
            >
              Save account
            </Button>
          </>
        ) : d.bankAccountNumber ? (
          <BankCard d={d} />
        ) : (
          <p className="mt-2 text-sm text-ink-soft">The seller has not given an account yet.</p>
        )}
      </Card>

      <Card>
        <h3 className="font-display text-2xl text-ink">Terms</h3>
        <p className="mt-1 text-sm text-ink-soft">
          Either of you can set these. Talk them over in the conversation first.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-[220px_1fr]">
          <Field label="Completion date" hint="When the full price is paid and the land handed over.">
            <Input
              type="date"
              value={terms.completionDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setTerms({ ...terms, completionDate: e.target.value })}
            />
          </Field>
          <Field label="Special terms (optional)" hint="e.g. payment in two instalments; seller clears the land first.">
            <Textarea
              value={terms.specialTerms}
              onChange={(e) => setTerms({ ...terms, specialTerms: e.target.value })}
            />
          </Field>
        </div>
        <Button
          className="mt-4"
          size="sm"
          variant="secondary"
          busy={busy === "terms"}
          onClick={() =>
            patch(
              "terms",
              { completionDate: terms.completionDate || null, specialTerms: terms.specialTerms },
              "Terms saved",
            ).then((ok) => ok && termsSaved("completionDate", "specialTerms"))
          }
        >
          Save terms
        </Button>
      </Card>

      <Witnesses room={room} reload={reload} me={me} />

      {me === "buyer" && (
        <div className="deep-ground rounded-4xl p-8 text-white">
          <h3 className="font-display text-3xl">Satisfied with your checks?</h3>
          <p className="mt-2 max-w-xl text-white/70">
            Preparing the agreement writes out the Contract of Sale with everything above. Both of you, and your
            witnesses, then sign it.
          </p>
          <Button
            variant="light"
            size="lg"
            className="mt-6"
            busy={busy === "prepare"}
            onClick={() => {
              if (window.confirm("Prepare the agreement now? Its terms will be fixed for signing."))
                void act("prepare", () => api(`/deals/${d.id}/agreement`, "POST"), "The agreement is ready to sign");
            }}
          >
            Prepare the agreement
          </Button>
        </div>
      )}
    </>
  );
}

function toLocalInput(iso: string) {
  const dt = new Date(iso);
  return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function BankCard({ d }: { d: Room["deal"] }) {
  return (
    <div className="mt-4 rounded-3xl bg-forest-950 p-6 text-white dark:ring-1 dark:ring-white/12">
      <p className="text-xs font-bold tracking-widest text-brass-300 uppercase">Pay only into</p>
      <p className="mt-3 font-mono text-3xl tracking-wider">{d.bankAccountNumber}</p>
      <p className="mt-2 text-lg">{d.bankAccountName}</p>
      <p className="text-white/60 dark:text-forest-800">{d.bankName}</p>
      <p className="mt-4 text-xs text-white/55 dark:text-forest-800">
        Never pay into any other account, whatever anyone says, even by phone. Any change must come through this deal
        room.
      </p>
    </div>
  );
}

// --- Witnesses -----------------------------------------------------------------------------

/** A Nigerian number as wa.me wants it: digits only, with the country code (0803… → 234803…). */
function whatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? `234${digits.slice(1)}` : digits;
}

function Witnesses({ room, reload, me }: Ctx) {
  const { busy, act } = useAct(reload);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "" });
  const [link, setLink] = useState<{ name: string; url: string; phone: string } | null>(null);
  const canEdit = ["checks", "agreement"].includes(room.deal.stage) && room.role !== "admin";

  const share = (name: string, url: string) =>
    `Hello ${name.split(" ")[0]}, I have named you as my witness on the sale of land "${room.listing.title}" on DesMind Lands. Please read the agreement and sign as witness here: ${url}`;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    // A second tap while the first is on its way would name, and email, the witness twice.
    if (busy) return;
    const sent = form;
    await act("add", async () => {
      const r = await api<{ link: string }>(`/deals/${room.deal.id}/witnesses`, "POST", sent);
      setLink({ name: sent.fullName, url: r.link, phone: sent.phone });
      setForm({ fullName: "", email: "", phone: "" });
      toast(sent.email ? "Witness added and emailed" : "Witness added. Send them the link.");
    });
  }

  return (
    <Card>
      <Eyebrow>Witnesses</Eyebrow>
      <h3 className="mt-4 font-display text-2xl text-ink">Each side names at least one</h3>
      <p className="mt-1 text-sm text-ink-soft">
        Someone you trust who knows you: a relative, a friend, your lawyer. Not the other party. They sign through a
        private link, with no account.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {(["seller", "buyer"] as const).map((side) => {
          const list = room.witnesses.filter((w) => w.side === side);
          return (
            <div key={side} className="rounded-3xl border border-line p-5">
              <p className="text-xs font-bold tracking-wider text-ink-faint uppercase">
                {side === "seller" ? "Seller's" : "Buyer's"} witnesses {side === me && "· yours"}
              </p>
              {list.length ? (
                <ul className="mt-3 space-y-3">
                  {list.map((w) => (
                    <li key={w.id} className="flex items-start gap-3">
                      <span
                        className={cx(
                          "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold",
                          w.current ? "bg-primary text-on-primary" : "bg-sunken text-ink-faint",
                        )}
                      >
                        {w.current ? <Icon d={icons.check} className="size-4" /> : w.fullName[0]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-ink">{w.fullName}</p>
                        <p className="text-xs text-ink-faint">
                          {w.current
                            ? `Signed ${formatMoment(w.signedAt)}`
                            : w.signedAt
                              ? "Signed an earlier version"
                              : "Not signed yet"}
                        </p>
                        {side === me && canEdit && !w.current && (
                          <div className="mt-1.5 flex gap-3 text-xs font-semibold">
                            <button
                              type="button"
                              disabled={busy !== null}
                              className="-m-2 p-2 text-forest-700 disabled:opacity-50"
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    `Make a new link for ${w.fullName}? Any link you already sent them will stop working.`,
                                  )
                                )
                                  return;
                                void act(`link${w.id}`, async () => {
                                  const r = await api<{ link: string }>(
                                    `/deals/${room.deal.id}/witnesses/${w.id}/link`,
                                    "POST",
                                  );
                                  setLink({ name: w.fullName, url: r.link, phone: w.phone });
                                });
                              }}
                            >
                              {busy === `link${w.id}` ? "Making…" : "New link"}
                            </button>
                            <button
                              type="button"
                              disabled={busy !== null}
                              className="-m-2 p-2 text-ink-faint hover:text-red-700 disabled:opacity-50"
                              onClick={() => {
                                if (!window.confirm(`Remove ${w.fullName} as a witness? Their link will stop working.`))
                                  return;
                                void act(
                                  w.id,
                                  () => api(`/deals/${room.deal.id}/witnesses/${w.id}`, "DELETE"),
                                  "Witness removed",
                                );
                              }}
                            >
                              {busy === w.id ? "Removing…" : "Remove"}
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-ink-faint">None yet.</p>
              )}
            </div>
          );
        })}
      </div>

      {link && (
        <div className="mt-6 animate-rise rounded-3xl border border-earth-200 bg-earth-50 p-5">
          <p className="font-semibold text-ink">Send {link.name} their link</p>
          <p className="mt-1 text-sm text-ink-soft">
            It is private: anyone with it can sign as this witness. A new link stops the old one.
          </p>
          <p className="mt-3 rounded-xl bg-surface px-3 py-2 font-mono text-xs break-all text-ink-soft">{link.url}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link.url);
                  toast("Link copied");
                } catch {
                  toast("Could not copy. Press and hold the link above to copy it.", "error");
                }
              }}
            >
              <Icon d={icons.link} className="size-4" />
              Copy link
            </Button>
            <a
              className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-on-primary"
              href={`https://wa.me/${whatsappNumber(link.phone)}?text=${encodeURIComponent(share(link.name, link.url))}`}
              target="_blank"
              rel="noreferrer"
            >
              Send on WhatsApp
            </a>
            <Button size="sm" variant="ghost" onClick={() => setLink(null)}>
              Done
            </Button>
          </div>
        </div>
      )}

      {canEdit && (
        <form
          onSubmit={add}
          className="mt-6 grid gap-3 border-t border-line pt-6 sm:grid-cols-[1.3fr_1.3fr_1fr_auto] sm:items-end"
        >
          <Field label="Witness's full name">
            {/* autoComplete off: the browser would offer the user's own name, email and phone. */}
            <Input
              required
              autoComplete="off"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              autoComplete="off"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Phone">
            <Input
              type="tel"
              autoComplete="off"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Button type="submit" busy={busy === "add"} className="h-[50px]">
            Add
          </Button>
        </form>
      )}
    </Card>
  );
}

// --- Agreement -----------------------------------------------------------------------------

function AgreementText({ room, collapsed }: { room: Room; collapsed?: boolean }) {
  const [open, setOpen] = useState(!collapsed);
  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-7 py-5">
        <div>
          <p className="font-display text-xl text-ink">Contract of Sale of Land</p>
          <p className="font-mono text-[11px] text-ink-faint">SHA-256 {room.deal.agreementHash?.slice(0, 24)}…</p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/deals/${room.deal.id}/agreement.pdf`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-full border border-line-strong px-4 text-[13px] font-semibold text-ink hover:border-forest-600"
          >
            <Icon d={icons.doc} className="size-4" />
            PDF
          </a>
          {collapsed && (
            <Button size="sm" variant="ghost" onClick={() => setOpen(!open)}>
              {open ? "Hide" : "Read"}
            </Button>
          )}
        </div>
      </div>
      {open && (
        <div className="survey-grid max-h-[560px] overflow-y-auto px-7 py-8 sm:px-12">
          <div className="agreement mx-auto max-w-2xl">{room.deal.agreementText}</div>
        </div>
      )}
    </Card>
  );
}

function Agreement({ room, reload, me }: Ctx) {
  const { busy, act } = useAct(reload);
  const mine = room.signatures.find((s) => s.party === me && s.current);
  const myName = me === "seller" ? room.seller.fullName : room.buyer.fullName;
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [read, setRead] = useState(false);
  const scroller = useRef<HTMLElement>(null);
  // "Read to the end" is measured by scrolling. A short agreement, or a tall screen, leaves
  // nothing to scroll, and nobody could ever sign: then it has been read as it stands.
  // biome-ignore lint/correctness/useExhaustiveDependencies: measure again when the text changes.
  useEffect(() => {
    const el = scroller.current;
    if (el && el.scrollHeight <= el.clientHeight + 40) setRead(true);
  }, [room.deal.agreementText]);

  const status = (["seller", "buyer"] as const).map((side) => ({
    side,
    party: room.signatures.find((s) => s.party === side && s.current),
    witnessed: room.witnesses.some((w) => w.side === side && w.current),
  }));

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {status.map(({ side, party, witnessed }) => (
          <div key={side} className="rounded-3xl border border-line bg-surface p-5 shadow-soft">
            <p className="text-xs font-bold tracking-wider text-ink-faint uppercase">
              {side === "seller" ? "Vendor" : "Purchaser"} {side === me && "· you"}
            </p>
            <p className="mt-1 font-display text-xl text-ink">
              {side === "seller" ? room.seller.fullName : room.buyer.fullName}
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <p className={cx("flex items-center gap-2", party ? "text-forest-700" : "text-ink-faint")}>
                <Icon d={party ? icons.check : icons.pen} className="size-4" />
                {party ? `Signed ${formatMoment(party.signedAt)}` : "Not signed"}
              </p>
              <p className={cx("flex items-center gap-2", witnessed ? "text-forest-700" : "text-ink-faint")}>
                <Icon d={witnessed ? icons.check : icons.users} className="size-4" />
                {witnessed ? "Witnessed" : "Waiting for a witness"}
              </p>
            </div>
          </div>
        ))}
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-7 py-5">
          <div>
            <p className="font-display text-2xl text-ink">Contract of Sale of Land</p>
            <p className="text-sm text-ink-soft">Read it to the end. Everyone signs exactly these words.</p>
          </div>
          <a
            href={`/api/deals/${room.deal.id}/agreement.pdf`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-full border border-line-strong px-4 text-[13px] font-semibold"
          >
            <Icon d={icons.doc} className="size-4" />
            PDF
          </a>
        </div>
        <section
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) setRead(true);
          }}
          // Focusable, so the keyboard can scroll it too.
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region must take focus to be scrolled by keyboard.
          tabIndex={0}
          aria-label="The agreement, in full"
          className="survey-grid max-h-[520px] overflow-y-auto px-7 py-8 sm:px-12"
        >
          <div className="agreement mx-auto max-w-2xl">{room.deal.agreementText}</div>
        </section>

        {room.role !== "admin" &&
          (mine ? (
            <div className="flex items-center gap-4 border-t border-line bg-forest-50 px-7 py-5">
              <span className="grid size-10 place-items-center rounded-full bg-primary text-on-primary">
                <Icon d={icons.check} />
              </span>
              <div>
                <p className="font-serif text-2xl text-forest-800 italic">{mine.signedName}</p>
                <p className="text-sm text-ink-soft">You signed {formatMoment(mine.signedAt)}</p>
              </div>
            </div>
          ) : (
            <form
              className="space-y-4 border-t border-line px-7 py-6"
              onSubmit={(e) => {
                e.preventDefault();
                void act(
                  "sign",
                  () =>
                    api(`/deals/${room.deal.id}/sign`, "POST", {
                      signedName: name,
                      agreementHash: room.deal.agreementHash,
                      consent,
                    }),
                  "Signed",
                );
              }}
            >
              {!read && <p className="text-sm text-earth-700">Scroll to the end of the agreement to sign.</p>}
              <Field label={`Type your full name to sign: ${myName}`}>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!read}
                  className="h-14 font-serif text-2xl italic"
                  placeholder={myName}
                />
              </Field>
              <label className="flex items-start gap-3 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={consent}
                  disabled={!read}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 size-5 accent-accent"
                />
                I have read this agreement and agree to it. Typing my name is my electronic signature (Evidence Act
                2011, s. 93).
              </label>
              <Button
                type="submit"
                variant="earth"
                size="lg"
                busy={busy === "sign"}
                disabled={!read || !consent || !name}
              >
                <Icon d={icons.pen} className="size-4" />
                Sign the agreement
              </Button>
            </form>
          ))}
      </Card>

      <Witnesses room={room} reload={reload} me={me} />

      {room.role !== "admin" && (
        <div className="text-sm text-ink-soft">
          Need to change a term?{" "}
          <button
            type="button"
            className="font-semibold text-earth-600 underline underline-offset-4"
            onClick={() => {
              const reason = window.prompt("What needs to change? Every signature so far will lapse.");
              if (reason)
                void act("revise", () => api(`/deals/${room.deal.id}/revise`, "POST", { reason }), "Terms reopened");
            }}
          >
            Reopen the terms
          </button>
        </div>
      )}
    </>
  );
}

// --- Payment -------------------------------------------------------------------------------

function PaymentStage({ room, reload, me }: Ctx) {
  const { busy, act } = useAct(reload);
  const d = room.deal;
  const agreed = d.agreedKobo ?? 0;
  const pct = agreed ? Math.min(100, Math.round((room.confirmedKobo / agreed) * 100)) : 0;
  const pending = room.payments.filter((p) => p.status === "submitted").reduce((n, p) => n + p.amountKobo, 0);

  return (
    <>
      <Card>
        <Eyebrow>Pay directly</Eyebrow>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-ink-soft">Confirmed by the seller</p>
            <p className="font-display text-5xl text-ink">{formatKobo(room.confirmedKobo)}</p>
          </div>
          <p className="text-right text-sm text-ink-soft">
            of {formatKobo(agreed)}
            <br />
            {pending > 0 && <span className="text-earth-600">{formatKobo(pending)} awaiting confirmation</span>}
          </p>
        </div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-sunken">
          <div
            className="h-full rounded-full bg-gradient-to-r from-forest-600 to-forest-400 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        {!d.paidAt && <BankCard d={d} />}
      </Card>

      {room.payments.length > 0 && (
        <Card className="p-0">
          <p className="border-b border-line px-7 py-4 font-display text-xl text-ink">Payments</p>
          <ul className="divide-y divide-line">
            {room.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-4 px-7 py-5">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-2xl text-ink">{formatKobo(p.amountKobo)}</p>
                  <p className="text-sm text-ink-soft capitalize">
                    {p.method} · {formatDay(p.paidOn)}
                    {p.reference && ` · ref ${p.reference}`}
                  </p>
                  {p.responseNote && <p className="mt-1 text-sm text-red-700">Seller: “{p.responseNote}”</p>}
                </div>
                {p.proofFileId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openFile(p.proofFileId!).catch((e) => toast(e.message, "error"))}
                  >
                    Receipt
                  </Button>
                )}
                {p.status === "submitted" && me === "seller" && room.role !== "admin" ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      busy={busy === `c${p.id}`}
                      onClick={() => {
                        if (window.confirm(`Confirm ${formatKobo(p.amountKobo)} has arrived in your account?`))
                          void act(
                            `c${p.id}`,
                            () => api(`/deals/${d.id}/payments/${p.id}/confirm`, "POST", {}),
                            "Payment confirmed",
                          );
                      }}
                    >
                      It arrived
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      busy={busy === `d${p.id}`}
                      onClick={() => {
                        const note = window.prompt("What is wrong with this payment?");
                        if (note)
                          void act(
                            `d${p.id}`,
                            () => api(`/deals/${d.id}/payments/${p.id}/dispute`, "POST", { note }),
                            "Buyer told",
                          );
                      }}
                    >
                      Not received
                    </Button>
                  </div>
                ) : (
                  <Badge
                    tone={p.status === "confirmed" ? "good" : p.status === "disputed" ? "bad" : "wait"}
                    live={p.status === "submitted"}
                  >
                    {p.status === "submitted"
                      ? "Awaiting seller"
                      : p.status === "confirmed"
                        ? "Confirmed"
                        : "Not received"}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {me === "buyer" && !d.paidAt && room.role !== "admin" && <RecordPayment room={room} reload={reload} me={me} />}

      {d.paidAt && (
        <div className="deep-ground rounded-4xl p-8 text-white">
          <Eyebrow light>Handover</Eyebrow>
          <h3 className="mt-4 font-display text-3xl">Paid in full. Now the land changes hands.</h3>
          <ul className="mt-5 space-y-2 text-white/75">
            <li className={cx(d.sellerHandoverAt && "text-white")}>
              {d.sellerHandoverAt ? "✓" : "○"} The seller hands over possession and the original papers
            </li>
            <li className={cx(d.buyerReceivedAt && "text-white")}>
              {d.buyerReceivedAt ? "✓" : "○"} The buyer confirms receiving them
            </li>
          </ul>
          {me === "seller" && !d.sellerHandoverAt && (
            <Button
              variant="light"
              size="lg"
              className="mt-6"
              busy={busy === "handover"}
              onClick={() => {
                if (window.confirm("Confirm you have handed over the land and its original documents?"))
                  void act("handover", () => api(`/deals/${d.id}/handover`, "POST"), "Handover confirmed");
              }}
            >
              I have handed over the land
            </Button>
          )}
          {me === "buyer" && d.sellerHandoverAt && (
            <Button
              variant="light"
              size="lg"
              className="mt-6"
              busy={busy === "handover"}
              onClick={() => {
                if (
                  window.confirm(
                    "Confirm you have received the land and its original documents? This completes the sale.",
                  )
                )
                  void act(
                    "handover",
                    () => api(`/deals/${d.id}/handover`, "POST"),
                    "Congratulations. The sale is complete.",
                  );
              }}
            >
              I have received the land
            </Button>
          )}
        </div>
      )}
    </>
  );
}

function RecordPayment({ room, reload }: Ctx) {
  const today = new Date().toISOString().slice(0, 10);
  // What is still to pay, less what the seller has yet to confirm: offering the whole balance
  // again after a payment is recorded invites the same payment being entered twice.
  const awaiting = room.payments.filter((p) => p.status === "submitted").reduce((n, p) => n + p.amountKobo, 0);
  const remaining = Math.max(0, (room.deal.agreedKobo ?? 0) - room.confirmedKobo - awaiting);
  const [f, setF] = useState({
    amount: remaining ? String(remaining / 100) : "",
    method: "transfer",
    reference: "",
    paidOn: today,
    note: "",
    signedName: "",
  });
  const [proof, setProof] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kobo = nairaToKobo(f.amount);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!kobo) return setError("Enter the amount paid.");
    setBusy(true);
    setError(null);
    try {
      await api(`/deals/${room.deal.id}/payments`, "POST", {
        amountKobo: kobo,
        method: f.method,
        reference: f.reference,
        paidOn: f.paidOn,
        note: f.note,
        proofFileId: proof,
        signedName: f.signedName,
      });
      toast("Payment recorded. The seller has been asked to confirm it.");
      setProof(null);
      setF({ ...f, amount: "", reference: "", note: "", signedName: "" });
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h3 className="font-display text-2xl text-ink">Record a payment</h3>
      <p className="mt-1 text-sm text-ink-soft">
        After paying the seller's account above, record it here with the receipt. Pay in parts if you agreed to.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Amount (₦)" hint={kobo ? formatKobo(kobo) : undefined}>
            <Input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          </Field>
          <Field label="How">
            <Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
              <option value="transfer">Bank transfer</option>
              <option value="cheque">Cheque</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Date paid">
            <Input type="date" max={today} value={f.paidOn} onChange={(e) => setF({ ...f, paidOn: e.target.value })} />
          </Field>
        </div>
        <Field label="Reference (from your bank)">
          <Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <UploadZone
            compact
            target={{ dealId: room.deal.id }}
            kind="payment_proof"
            accept="image/*,application/pdf"
            label={proof ? "Replace receipt" : "Attach receipt"}
            onDone={(ids) => setProof(ids[0] ?? null)}
            onBusyChange={setUploading}
          />
          {proof && !uploading && <span className="text-sm text-forest-700">✓ Receipt attached</span>}
        </div>
        <Field
          label={`Sign with your full name: ${room.buyer.fullName}`}
          hint="You declare this payment was made as described, and the receipt is genuine."
        >
          <Input
            value={f.signedName}
            onChange={(e) => setF({ ...f, signedName: e.target.value })}
            className="font-serif text-lg italic"
          />
        </Field>
        <ErrorText error={error} />
        {/* Not while the receipt is still on its way up: the payment would go in without it. */}
        <Button type="submit" variant="earth" busy={busy} disabled={uploading}>
          {uploading ? "Waiting for the receipt…" : "Record payment"}
        </Button>
      </form>
    </Card>
  );
}

function Completed({ room }: Ctx) {
  const saved = (room.deal.agreedKobo ?? 0) * 0.1;
  return (
    <div className="deep-ground relative overflow-hidden rounded-4xl p-10 text-white">
      <div className="absolute inset-y-0 right-0 w-1/2 opacity-40" aria-hidden="true">
        <PlotArt seed={room.listing.id} landUse={room.listing.landUse} animate />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--deep)] to-transparent" />
      </div>
      <div className="relative max-w-lg">
        <Eyebrow light>Sold · {formatDay(room.deal.completedAt)}</Eyebrow>
        <h2 className="mt-4 font-display text-5xl leading-tight">The land has changed hands.</h2>
        <p className="mt-4 text-white/70">
          {formatKobo(room.deal.agreedKobo)}, buyer to seller, with no agent. Each side kept up to {formatKobo(saved)}{" "}
          that an agent would have charged.
        </p>
        <a
          href={`/api/deals/${room.deal.id}/agreement.pdf`}
          target="_blank"
          rel="noreferrer"
          className="mt-8 inline-flex h-14 items-center gap-2 rounded-full bg-white px-8 font-semibold text-forest-950"
        >
          <Icon d={icons.doc} className="size-5" />
          Download the signed agreement
        </a>
        <p className="mt-8 text-sm text-white/55">
          Next, for the buyer: execute a Deed of Assignment, then register it and obtain the Governor's Consent at the{" "}
          {room.listing.state} Lands Registry, where the law requires it.
        </p>
      </div>
    </div>
  );
}

// --- Sidebar -------------------------------------------------------------------------------

function Conversation({ room, reload, me }: Ctx) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const myId = me === "seller" ? room.seller.id : room.buyer.id;
  const closed = ["completed", "cancelled"].includes(room.deal.stage) || room.role === "admin";
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new messages.
  useEffect(() => {
    // The box only: scrollIntoView would drag the whole page down to the chat on a phone,
    // on opening the room and again with every new message.
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [room.messages.length]);

  return (
    <Card className="p-0">
      <p className="flex items-center gap-2 border-b border-line px-5 py-4 font-display text-lg text-ink">
        <Icon d={icons.chat} className="text-earth-600" />
        Conversation
      </p>
      <div ref={box} className="max-h-96 space-y-3 overflow-y-auto px-5 py-4">
        {room.messages.length === 0 && (
          <p className="text-sm text-ink-faint">Messages between you stay here, on record.</p>
        )}
        {room.messages.map((m) => {
          const mine = m.authorId === myId;
          return (
            <div key={m.id} className={cx("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cx(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                  mine ? "rounded-br-md bg-primary text-on-primary" : "rounded-bl-md bg-sunken text-ink",
                )}
              >
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={cx("mt-1 text-[10px]", mine ? "text-white/50 dark:text-forest-800" : "text-ink-faint")}>
                  {timeAgo(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {!closed && (
        <form
          className="flex gap-2 border-t border-line p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!body.trim()) return;
            setBusy(true);
            try {
              await api(`/deals/${room.deal.id}/messages`, "POST", { body });
              setBody("");
              await reload();
            } catch (err) {
              toast((err as Error).message, "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a message"
            aria-label="Message"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-full bg-sunken px-4 text-sm outline-none focus:ring-2 focus:ring-forest-200"
          />
          <Button type="submit" size="sm" busy={busy} className="h-10">
            Send
          </Button>
        </form>
      )}
    </Card>
  );
}

function Documents({ room, reload }: Ctx) {
  const closed = ["completed", "cancelled"].includes(room.deal.stage) || room.role === "admin";
  return (
    <Card className="p-5">
      <p className="font-display text-lg text-ink">Documents in this deal</p>
      {room.files.length ? (
        <ul className="mt-3 space-y-1.5">
          {room.files.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => openFile(f.id).catch((e) => toast(e.message, "error"))}
                className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-sunken"
              >
                <Icon d={icons.doc} className="size-4 text-earth-600" />
                <span className="flex-1 truncate">{f.filename}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-ink-faint">Receipts and papers you share appear here.</p>
      )}
      {!closed && (
        <div className="mt-4">
          <UploadZone
            compact
            target={{ dealId: room.deal.id }}
            kind="other"
            accept="image/*,application/pdf"
            label="Share a document"
            onDone={reload}
          />
        </div>
      )}
    </Card>
  );
}

function CancelDeal({ room, reload }: Ctx) {
  const { busy, act } = useAct(reload);
  return (
    <button
      type="button"
      disabled={busy === "cancel"}
      onClick={() => {
        const reason = window.prompt("Why are you cancelling this deal? The other party will see this.");
        if (reason)
          void act("cancel", () => api(`/deals/${room.deal.id}/cancel`, "POST", { reason }), "Deal cancelled");
      }}
      className="w-full rounded-full py-3 text-sm font-semibold text-ink-faint hover:bg-red-50 hover:text-red-700"
    >
      Cancel this deal
    </button>
  );
}

function Timeline({ room }: { room: Room }) {
  const [all, setAll] = useState(false);
  const events = [...room.events].reverse();
  const shown = all ? events : events.slice(0, 6);
  return (
    <Card>
      <p className="font-display text-2xl text-ink">On record</p>
      <ol className="relative mt-6 space-y-5 border-l border-line pl-6">
        {shown.map((e) => (
          <li key={e.id} className="relative">
            <span className="absolute top-1.5 -left-[29px] size-2.5 rounded-full bg-earth-500 ring-4 ring-surface" />
            <p className="text-sm text-ink">{e.summary}</p>
            <p className="mt-0.5 text-xs text-ink-faint">{formatMoment(e.createdAt)}</p>
          </li>
        ))}
      </ol>
      {events.length > 6 && (
        <button type="button" onClick={() => setAll(!all)} className="mt-5 text-sm font-semibold text-earth-600">
          {all ? "Show less" : `Show all ${events.length}`}
        </button>
      )}
      <p className="mt-6 border-t border-line pt-4 text-xs text-ink-faint">
        <Badge tone={statusTone[room.deal.stage]}>{STAGE_LABEL[room.deal.stage]}</Badge>
        <span className="ml-2">Opened {formatDay(room.deal.createdAt)}</span>
      </p>
    </Card>
  );
}
