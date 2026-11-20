"use client";

import { useEffect, useState } from "react";

/*
 * Short confirmations ("Contact details saved") that appear at the bottom of the screen and go
 * away on their own. Any component calls `toast(...)`; the one <Toaster /> in the layout shows
 * them. A form that saves closes itself and says so here, rather than staying open.
 */

type Toast = { id: number; text: string; tone: "done" | "error" };
const EVENT = "lands:toast";
let next = 1;

export function toast(text: string, tone: Toast["tone"] = "done") {
  window.dispatchEvent(new CustomEvent<Toast>(EVENT, { detail: { id: next++, text, tone } }));
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const onToast = (e: Event) => {
      const t = (e as CustomEvent<Toast>).detail;
      // At most three at once: the newest push the oldest out.
      setItems((prev) => [...prev.slice(-2), t]);
      const timer = setTimeout(
        () => {
          setItems((prev) => prev.filter((x) => x.id !== t.id));
          timers.delete(timer);
        },
        t.tone === "error" ? 7000 : 3500,
      );
      timers.add(timer);
    };
    window.addEventListener(EVENT, onToast);
    return () => {
      window.removeEventListener(EVENT, onToast);
      for (const t of timers) clearTimeout(t);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 max-sm:top-0 max-sm:pt-[max(0.75rem,env(safe-area-inset-top))] sm:bottom-0 sm:pb-[max(1.25rem,env(safe-area-inset-bottom))] print:hidden"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className="pointer-events-auto flex max-w-md animate-rise items-center gap-3 rounded-full bg-[oklch(0.22_0.04_162)] py-2.5 pr-3 pl-3.5 text-sm font-medium text-white shadow-2xl ring-1 ring-white/10"
        >
          <span
            aria-hidden="true"
            className={
              t.tone === "error"
                ? "grid size-5 shrink-0 place-items-center rounded-full bg-red-500 text-[11px] font-bold"
                : "grid size-5 shrink-0 place-items-center rounded-full bg-[#D2AE62] text-[oklch(0.22_0.04_165)]"
            }
          >
            {t.tone === "error" ? (
              "!"
            ) : (
              <svg
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="size-3"
                aria-hidden="true"
              >
                <path d="m2.5 6.2 2.2 2.2 4.8-4.9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span className="min-w-0">{t.text}</span>
          <button
            type="button"
            onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
            aria-label="Dismiss"
            className="ml-1 grid size-6 shrink-0 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
          >
            <svg
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              className="size-3"
              aria-hidden="true"
            >
              <path d="M3 3l6 6M9 3 3 9" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
