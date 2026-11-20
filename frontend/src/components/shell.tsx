"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PlotArt } from "./plot-art";
import { cx, Eyebrow, Logo, Spinner } from "./ui";

/** A page under the fixed header. */
export function Page({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <div
      className={cx("mx-auto w-full px-4 pt-28 pb-10 sm:px-6 sm:pt-32", wide ? "max-w-7xl" : "max-w-6xl", className)}
    >
      {children}
    </div>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center gap-3 text-ink-faint">
      <Spinner className="size-5 text-earth-500" />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

/** Sign-in and sign-up: the form beside a survey plan (hidden on phones). */
export function AuthShell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: ReactNode }) {
  return (
    <div className="mx-auto grid min-h-dvh max-w-7xl items-stretch gap-10 px-4 pt-28 pb-10 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
      <div className="relative hidden overflow-hidden rounded-[2rem] lg:block">
        <PlotArt seed="auth-plan-oak" landUse="residential" animate />
        <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.15_0.03_165/0.95)] via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-10">
          <Eyebrow light>DesMind Lands</Eyebrow>
          <p className="mt-4 max-w-sm font-display text-3xl leading-tight text-white">
            Land sold directly, owner to buyer, with witnesses and every payment on record.
          </p>
        </div>
      </div>
      <div className="flex animate-rise items-center">
        <div className="mx-auto w-full max-w-md py-6">
          <Link href="/" className="mb-10 inline-block lg:hidden">
            <Logo />
          </Link>
          <h1 className="font-display text-4xl text-ink">{title}</h1>
          {subtitle && <p className="mt-3 text-ink-soft">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
