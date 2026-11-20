"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PlotArt } from "./plot-art";
import { cx, Eyebrow, Icon, icons, Logo, Spinner, TitleSearchSeal } from "./ui";

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
    <div className="mx-auto grid min-h-dvh max-w-7xl items-stretch gap-10 px-4 pt-28 pb-10 sm:px-6 lg:grid-cols-[1fr_1fr] lg:gap-16">
      <div className="deep-ground relative hidden flex-col justify-between overflow-hidden rounded-4xl p-10 text-white lg:flex">
        <div className="survey-grid absolute inset-0 [--grid-line:oklch(1_0_0/0.04)]" aria-hidden="true" />
        <div className="relative">
          <Eyebrow light>DesMind Lands · Enugu State</Eyebrow>
          <p className="mt-5 max-w-md font-display text-[2.1rem] leading-[1.12]">
            Land sold directly, owner to buyer. <span className="text-brass-300">Every title searched first.</span>
          </p>
        </div>
        <div className="relative my-10 overflow-hidden rounded-3xl shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/15">
          <div className="aspect-[16/10]">
            <PlotArt seed="auth-plan-oak" landUse="residential" animate />
          </div>
          <div className="absolute right-4 bottom-4 rounded-2xl bg-white p-3 pr-4 shadow-lift">
            <TitleSearchSeal at="2026-11-04" />
          </div>
        </div>
        <ul className="relative grid grid-cols-3 gap-4 border-t border-white/12 pt-6 text-[13px] text-white/70">
          {(
            [
              [icons.shield, "Titles searched at the Ministry of Lands"],
              [icons.users, "A witness for each side"],
              [icons.coins, "No agent, no commission"],
            ] as const
          ).map(([icon, text]) => (
            <li key={text} className="flex flex-col gap-2.5">
              <Icon d={icon} className="size-5 text-brass-300" />
              {text}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex animate-rise items-center">
        <div className="mx-auto w-full max-w-md py-6">
          <Link href="/" className="mb-10 inline-block lg:hidden">
            <Logo />
          </Link>
          <h1 className="font-display text-[2.6rem] leading-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-3 text-[16px] text-ink-soft">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
