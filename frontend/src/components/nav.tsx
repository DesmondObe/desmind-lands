"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { useSession } from "./session";
import { ButtonLink, cx, Logo } from "./ui";

/** Pages that open on a black, photographed hero: the header sits over it, light on dark. */
const DARK_HERO = ["/", "/how-it-works"];

export function ThemeToggle({ light }: { light?: boolean }) {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.dataset.theme === "dark"), []);
  const flip = () => {
    const next = dark ? "light" : "dark";
    const html = document.documentElement;
    html.classList.add("theme-transition");
    html.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {}
    setDark(!dark);
    setTimeout(() => html.classList.remove("theme-transition"), 350);
  };
  return (
    <button
      type="button"
      onClick={flip}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={cx(
        "grid size-10 place-items-center rounded-full transition",
        light ? "text-white/75 hover:bg-white/10 hover:text-white" : "text-ink-soft hover:bg-sunken hover:text-ink",
      )}
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="size-[18px]"
        aria-hidden="true"
      >
        {dark ? (
          <path
            d="M10 14.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM10 1.5v1.5m0 14v1.5M3.99 3.99l1.06 1.06m9.9 9.9 1.06 1.06M1.5 10H3m14 0h1.5M3.99 16.01l1.06-1.06m9.9-9.9 1.06-1.06"
            strokeLinecap="round"
          />
        ) : (
          <path d="M16.5 12.2A7 7 0 0 1 7.8 3.5a7 7 0 1 0 8.7 8.7Z" strokeLinejoin="round" />
        )}
      </svg>
    </button>
  );
}

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { me, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const overHero = DARK_HERO.includes(pathname) && !scrolled && !open;

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: close the menu whenever the page changes.
  useEffect(() => setOpen(false), [pathname]);

  const links: [string, string][] = [
    ["/lands", "Buy land"],
    ["/sell", "Sell land"],
    ["/how-it-works", "How it works"],
    ...(me ? ([["/dashboard", "Dashboard"]] as [string, string][]) : []),
    ...(me?.user.platformRole === "admin" ? ([["/admin", "Review"]] as [string, string][]) : []),
  ];
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const initials = me?.user.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  const leave = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 print:hidden">
      {/* One floating bar: glass over a photographed hero, paper everywhere else. */}
      <div
        className={cx(
          "relative mx-auto flex h-14 max-w-7xl items-center gap-4 rounded-full pr-2 pl-4 ring-1 backdrop-blur-xl transition-[background-color,box-shadow] duration-300 sm:pl-5",
          overHero
            ? "bg-black/35 ring-white/20"
            : "bg-canvas/90 shadow-[0_10px_30px_-18px_oklch(0_0_0/0.45)] ring-line backdrop-saturate-150",
        )}
      >
        <Link href="/" aria-label="DesMind Lands, home">
          <Logo inverted={overHero} />
        </Link>
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 lg:flex">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? "page" : undefined}
              className={cx(
                "flex items-center rounded-full px-3.5 py-1.5 text-[14px] font-semibold whitespace-nowrap transition",
                overHero
                  ? active(href)
                    ? "bg-white/15 text-white"
                    : "text-white hover:bg-white/10"
                  : active(href)
                    ? "bg-ink text-canvas"
                    : "text-ink hover:bg-sunken",
              )}
            >
              {label}
              {href === "/dashboard" && !!me?.openDeals && (
                <span
                  className={cx(
                    "ml-1.5 inline-grid min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-bold",
                    overHero || active(href) ? "bg-white text-black" : "bg-ink text-canvas",
                  )}
                >
                  {me.openDeals}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle light={overHero} />
          {me ? (
            <div className="hidden items-center gap-1 sm:flex">
              <button
                type="button"
                onClick={leave}
                className={cx(
                  "rounded-full px-3 py-2 text-[13px] font-semibold",
                  overHero ? "text-white hover:bg-white/10" : "text-ink hover:bg-sunken",
                )}
              >
                Sign out
              </button>
              <Link
                href="/account"
                className={cx(
                  "grid size-10 place-items-center rounded-full text-[13px] font-bold",
                  overHero ? "bg-white text-black" : "bg-ink text-canvas",
                )}
                title={me.user.fullName}
                aria-label="Your account"
              >
                {initials}
              </Link>
            </div>
          ) : (
            <div className="hidden items-center gap-1 sm:flex">
              <Link
                href="/login"
                className={cx(
                  "rounded-full px-3.5 py-2 text-[14px] font-semibold",
                  overHero ? "text-white hover:bg-white/10" : "text-ink hover:bg-sunken",
                )}
              >
                Sign in
              </Link>
              <ButtonLink href="/sell" size="sm" variant={overHero ? "light" : "primary"} className="h-10 px-5">
                List your land
              </ButtonLink>
            </div>
          )}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
            aria-expanded={open}
            className={cx(
              "grid size-10 place-items-center rounded-full lg:hidden",
              overHero ? "text-white hover:bg-white/10" : "text-ink hover:bg-sunken",
            )}
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              className="size-5"
              aria-hidden="true"
            >
              {open ? (
                <path d="M5 5l10 10M15 5 5 15" strokeLinecap="round" />
              ) : (
                <path d="M3 7h14M3 13h14" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <div className="mx-auto mt-2 max-w-7xl animate-fade-in rounded-3xl bg-canvas px-5 pt-2 pb-5 shadow-[0_20px_40px_-20px_oklch(0_0_0/0.5)] ring-1 ring-line lg:hidden">
          <nav className="flex flex-col">
            {links.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                aria-current={active(href) ? "page" : undefined}
                className="flex items-center justify-between border-b border-line py-3.5 text-[17px] font-semibold text-ink"
              >
                {label}
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </nav>
          <div className="mt-5 flex gap-3">
            {me ? (
              <>
                <ButtonLink href="/account" variant="secondary" className="flex-1">
                  Account
                </ButtonLink>
                <button
                  type="button"
                  onClick={leave}
                  className="flex-1 rounded-full border border-line-strong py-3 text-sm font-semibold text-ink"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <ButtonLink href="/login" variant="secondary" className="flex-1">
                  Sign in
                </ButtonLink>
                <ButtonLink href="/sell" className="flex-1">
                  List your land
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
