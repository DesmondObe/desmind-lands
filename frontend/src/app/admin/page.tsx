"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PlotArt } from "@/components/plot-art";
import { useRequireSignIn } from "@/components/session";
import { Loading, Page } from "@/components/shell";
import { toast } from "@/components/toast";
import {
  Badge,
  Button,
  cx,
  Empty,
  ErrorText,
  Field,
  Input,
  PageTitle,
  statusTone,
  TitleSearchSeal,
} from "@/components/ui";
import { api } from "@/lib/api";
import { formatKobo, formatSize, LISTING_STATUS, STAGE_LABEL, TITLE_LABEL, timeAgo } from "@/lib/land";

type Row = {
  id: string;
  title: string;
  town: string;
  state: string;
  lga: string;
  priceKobo: number;
  sizeValue: number;
  sizeUnit: string;
  titleKind: string;
  status: string;
  updatedAt: string;
  sellerName: string;
  sellerEmail: string;
  sellerPhone: string;
  papers: number;
  titleReference: string;
  titleSearchedAt: string | null;
  titleSearchRef: string;
  titleSearchNote: string;
  coverUrl: string | null;
  photoCount: number;
};
type DealRow = {
  id: string;
  stage: string;
  agreedKobo: number | null;
  updatedAt: string;
  title: string;
  town: string;
  sellerName: string;
  buyerName: string;
  disputed: number;
};

const TABS = ["in_review", "published", "under_offer", "sold", "rejected", "deals"] as const;

export default function AdminPage() {
  const { me } = useRequireSignIn();
  const [tab, setTab] = useState<(typeof TABS)[number]>("in_review");
  const [overview, setOverview] = useState<Record<string, number> | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [deals, setDeals] = useState<DealRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const latest = useRef(0);

  const load = useCallback(async () => {
    // Each load takes a number; only the newest may write. Without it, a slow answer for the
    // tab just left lands after, and over, the answer for the tab now open.
    const mine = ++latest.current;
    try {
      const [o, list] = await Promise.all([
        api<Record<string, number>>("/admin/overview"),
        tab === "deals"
          ? api<{ deals: DealRow[] }>("/admin/deals")
          : api<{ listings: Row[] }>(`/admin/listings?status=${tab}`),
      ]);
      if (mine !== latest.current) return;
      setOverview(o);
      if ("deals" in list) setDeals(list.deals);
      else setRows(list.listings);
      setError(null);
    } catch (err) {
      if (mine === latest.current) setError((err as Error).message);
    }
  }, [tab]);
  useEffect(() => {
    if (!me) return;
    // The last tab's rows are not this tab's: show nothing until its own arrive.
    setRows(null);
    setDeals(null);
    void load();
  }, [me, load]);

  if (error && !overview)
    return (
      <Page>
        <div className="flex flex-wrap items-center gap-3">
          <ErrorText error={error} />
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      </Page>
    );
  if (!overview) return <Loading />;

  const review = async (id: string, status: "published" | "rejected") => {
    const note = status === "rejected" ? window.prompt("What should the seller change?") : "";
    if (status === "rejected" && !note) return;
    setActing(`${status}${id}`);
    try {
      await api(`/listings/${id}/status`, "POST", { status, note });
      toast(status === "published" ? "Published" : "Sent back to the seller");
      await load();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setActing(null);
    }
  };

  return (
    <Page wide>
      <PageTitle eyebrow="DesMind staff" title="Review and oversight" />
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["In review", overview.inReview],
          ["On the market", overview.live],
          ["Sold", overview.sold],
          ["Open deals", overview.openDeals],
          ["Value sold", formatKobo(overview.completedValueKobo ?? 0)],
          ["Disputed payments", overview.disputedPayments],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <p className="text-xs font-semibold text-ink-faint">{k}</p>
            <p className="mt-2 font-display text-3xl text-ink tabular">{v}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <ErrorText error={error} />
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      )}

      <div className="no-scrollbar mt-10 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            aria-current={tab === t ? "page" : undefined}
            onClick={() => setTab(t)}
            className={cx(
              "-mb-px border-b-2 px-4 py-3 text-sm font-semibold whitespace-nowrap",
              tab === t ? "border-earth-500 text-ink" : "border-transparent text-ink-faint hover:text-ink",
            )}
          >
            {t === "deals" ? "Deals" : LISTING_STATUS[t]}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === "deals" ? (
          deals?.length ? (
            <div className="overflow-x-auto rounded-3xl border border-line bg-surface">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-ink-faint uppercase">
                  <tr>
                    {["Land", "Seller", "Buyer", "Stage", "Price", "Updated"].map((h) => (
                      <th key={h} className="px-5 py-3 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {deals.map((d) => (
                    <tr key={d.id} className="hover:bg-sunken">
                      <td className="px-5 py-3">
                        <Link href={`/deals/${d.id}`} className="font-semibold text-ink hover:underline">
                          {d.title}
                        </Link>
                        <span className="block text-xs text-ink-faint">{d.town}</span>
                      </td>
                      <td className="px-5 py-3">{d.sellerName}</td>
                      <td className="px-5 py-3">{d.buyerName}</td>
                      <td className="px-5 py-3">
                        <Badge tone={d.disputed ? "bad" : statusTone[d.stage]}>
                          {d.disputed ? "Disputed payment" : STAGE_LABEL[d.stage]}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 tabular-nums">{formatKobo(d.agreedKobo)}</td>
                      <td className="px-5 py-3 text-ink-faint">{timeAgo(d.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="No deals yet" />
          )
        ) : rows?.length ? (
          <ul className="space-y-4">
            {rows.map((r) => (
              <li
                key={r.id}
                className="grid gap-5 rounded-3xl border border-line bg-surface p-5 shadow-soft md:grid-cols-[160px_1fr_auto]"
              >
                <div className="aspect-[4/3] overflow-hidden rounded-2xl">
                  {r.coverUrl ? (
                    // biome-ignore lint/performance/noImgElement: signed storage URL.
                    <img src={r.coverUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <PlotArt seed={r.id} />
                  )}
                </div>
                <div className="min-w-0">
                  <Badge tone={statusTone[r.status]}>{LISTING_STATUS[r.status]}</Badge>
                  <Link href={`/lands/${r.id}`} className="mt-2 block font-display text-xl text-ink hover:underline">
                    {r.title}
                  </Link>
                  <p className="text-sm text-ink-soft">
                    {r.town}
                    {r.lga && `, ${r.lga}`}, {r.state} · {formatSize(r.sizeValue, r.sizeUnit)} ·{" "}
                    {formatKobo(r.priceKobo)}
                  </p>
                  <p className="mt-1 text-sm text-ink-soft">
                    {TITLE_LABEL[r.titleKind]} · {r.papers} paper{r.papers === 1 ? "" : "s"} · {r.photoCount} photo
                    {r.photoCount === 1 ? "" : "s"}
                  </p>
                  <p className="mt-2 text-xs text-ink-faint">
                    {r.sellerName} · {r.sellerEmail}
                    {r.sellerPhone && ` · +${r.sellerPhone}`} · {timeAgo(r.updatedAt)}
                  </p>
                  {r.titleSearchedAt ? (
                    <div className="mt-4 rounded-2xl bg-forest-50 p-4 text-sm">
                      <TitleSearchSeal at={r.titleSearchedAt} />
                      <p className="mt-3 text-ink-soft">
                        <span className="font-mono text-xs">Ref. {r.titleSearchRef}</span>
                        {r.titleSearchNote && <> · {r.titleSearchNote}</>}
                      </p>
                    </div>
                  ) : (
                    r.status === "in_review" && (
                      <TitleSearchForm id={r.id} titleReference={r.titleReference} onDone={load} />
                    )
                  )}
                </div>
                {r.status === "in_review" && (
                  <div className="flex gap-2 md:flex-col">
                    <Button
                      onClick={() => review(r.id, "published")}
                      busy={acting === `published${r.id}`}
                      disabled={!r.titleSearchedAt || acting !== null}
                      title={r.titleSearchedAt ? undefined : "Record the Ministry of Lands title search first"}
                    >
                      Publish
                    </Button>
                    <Button
                      variant="secondary"
                      busy={acting === `rejected${r.id}`}
                      disabled={acting !== null}
                      onClick={() => review(r.id, "rejected")}
                    >
                      Needs changes
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty title={tab === "in_review" ? "Nothing waiting for review" : "Nothing here"} />
        )}
      </div>
    </Page>
  );
}

/** Staff: record the search of a listing's title at the State Ministry of Lands. */
function TitleSearchForm({ id, titleReference, onDone }: { id: string; titleReference: string; onDone: () => void }) {
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await api(`/admin/listings/${id}/title-search`, "POST", { reference, note });
          toast("Title search recorded");
          onDone();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
      className="mt-4 space-y-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-4"
    >
      <p className="text-sm font-semibold text-amber-800">
        Search the title at the Enugu State Ministry of Lands before publishing.
        {titleReference && <span className="font-normal"> Seller&apos;s title ref: {titleReference}</span>}
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <Field label="Ministry search reference">
          <Input required value={reference} onChange={(e) => setReference(e.target.value)} placeholder="ENS/MLS/…" />
        </Field>
        <Field label="What the search showed">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="On record in the seller's name; no encumbrance"
          />
        </Field>
      </div>
      <ErrorText error={error} />
      <Button type="submit" size="sm" busy={busy}>
        Record title search
      </Button>
    </form>
  );
}
