import type { ReactNode } from "react";
import { PageTitle } from "./ui";

/** A page of plain writing: terms, privacy. */
export function Prose({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-32 sm:px-6">
      <PageTitle eyebrow={eyebrow} title={title} subtitle={`Last updated ${updated}`} />
      <div className="space-y-6 text-[16px] leading-[1.8] text-ink-soft [&_h2]:mt-12 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-ink [&_strong]:text-ink">
        {children}
      </div>
    </div>
  );
}
