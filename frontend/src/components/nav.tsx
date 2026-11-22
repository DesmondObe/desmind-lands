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

  return (
    <header
      className={cx(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,border-color] duration-300 print:hidden",
        overHero
          ? "border-b border-white/30 bg-transparent"
          : "border-b border-line bg-canvas/80 backdrop-blur-xl backdrop-saturate-150",
      )}
    >
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="DesMind Lands, home">
          <Logo inverted={overHero} />
        </Link>
        <nav className="ml-6 hidden items-center gap-1 lg:flex">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={cx(
                "relative rounded-full px-3.5 py-2 text-[14px] font-semibold transition",
                overHero ? "text-white hover:text-white" : active(href) ? "text-ink" : "text-ink",
              )}
            >
              {label}
              {href === "/dashboard" && !!me?.openDeals && (
                <span
                  className={cx(
                    "ml-1.5 inline-grid min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-bold",
                    overHero ? "bg-white text-black" : "bg-accent text-on-accent",
                  )}
                >
                  {me.openDeals}
                </span>
              )}
              {active(href) && !overHero && (
                <span className="absolute inset-x-3.5 -bottom-[17px] h-0.5 rounded-full bg-accent" aria-hidden="true" />
              )}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/lands"
            className={cx(
              "mr-2 hidden items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold xl:flex",
              overHero ? "bg-white/8 text-white/80 ring-1 ring-white/15" : "bg-sunken text-ink-soft ring-1 ring-line",
            )}
          >
            <span
              className={cx("size-1.5 animate-pulse-dot rounded-full", overHero ? "bg-white" : "bg-accent")}
              aria-hidden="true"
            />
            Now in Enugu State
          </Link>
          <ThemeToggle light={overHero} />
          {me ? (
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                href="/account"
                className={cx(
                  "grid size-10 place-items-center rounded-full text-sm font-bold",
                  overHero ? "bg-white/10 text-white ring-1 ring-white/20" : "bg-ink text-canvas",
                )}
                title={me.user.fullName}
              >
                {me.user.fullName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join("")
                  .toUpperCase()}
              </Link>
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  router.push("/");
                }}
                className={cx("rounded-full px-3 py-2 text-[13px] font-semibold", overHero ? "text-white" : "text-ink")}
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                href="/login"
                className={cx("rounded-full px-4 py-2 text-[14px] font-semibold", overHero ? "text-white" : "text-ink")}
              >
                Sign in
              </Link>
              <ButtonLink href="/sell" size="sm" variant={overHero ? "light" : "primary"}>
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
                <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <div className="animate-fade-in border-t border-line bg-canvas px-4 pt-3 pb-6 lg:hidden">
          <nav className="flex flex-col">
            {links.map(([href, label]) => (
              <Link key={href} href={href} className="border-b border-line py-4 font-display text-2xl text-ink">
                {label}
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
                  onClick={async () => {
                    await signOut();
                    router.push("/");
                  }}
                  className="flex-1 rounded-full border border-line-strong py-3 text-sm font-semibold"
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
