"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PhotoGround } from "./photo";
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
    <div className="mx-auto grid min-h-dvh max-w-7xl items-stretch gap-10 px-4 pt-28 pb-10 sm:px-6 lg:grid-cols-[1fr_1fr] lg:gap-16">
      <div className="relative hidden flex-col justify-end overflow-hidden rounded-3xl bg-black p-10 text-white lg:flex">
        <PhotoGround name="nsukka-homes" />
        <div className="relative">
          <Eyebrow light>DesMind Lands · Enugu State</Eyebrow>
          <p className="mt-6 font-display text-4xl leading-[1.05] tracking-[-0.025em]">
            Owner to buyer. <span className="italic">Every title searched first.</span>
          </p>
          <ul className="mt-10 grid grid-cols-3 gap-6 border-t border-white/25 pt-5 text-sm text-white/80">
            <li>No agent</li>
            <li>No commission</li>
            <li>A witness for each side</li>
          </ul>
        </div>
      </div>
      <div className="flex animate-rise items-center">
        <div className="mx-auto w-full max-w-md py-6">
          <Link href="/" className="mb-10 inline-block lg:hidden">
            <Logo />
          </Link>
          <h1 className="font-display text-4xl leading-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-3 text-[16px] text-ink-soft">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
