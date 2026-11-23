"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { useSession } from "./session";
import { ButtonLink, cx, Icon, icons, Logo } from "./ui";

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

/**
 * The header. Over a photographed hero it sits inside the photograph's frame, clear, with
 * white lettering; once the page scrolls it becomes a slim white bar. Links are lettered in
 * the monospace like the labels on a plan, and the page you are on carries a beacon dot.
 */
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
  // The open menu covers the page, so the page behind it must not scroll.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const links: [string, string][] = [
    ["/lands", "Buy land"],
    ["/sell", "Sell land"],
    ["/how-it-works", "How it works"],
    ...(me ? ([["/dashboard", "Dashboard"]] as [string, string][]) : []),
    ...(me?.user.platformRole === "admin" ? ([["/admin", "Review"]] as [string, string][]) : []),
  ];
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const leave = async () => {
    await signOut();
    router.push("/");
  };
  const initials = me?.user.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <header
      className={cx(
        "fixed z-50 transition-[background-color,border-color,inset] duration-300 print:hidden",
        overHero
          ? "inset-x-2 top-2 border-b border-white/20 bg-transparent sm:inset-x-3 sm:top-3"
          : "inset-x-0 top-0 border-b border-line bg-canvas/90 backdrop-blur-xl",
      )}
    >
      <div
        className={cx(
          "mx-auto flex max-w-[92rem] items-center gap-6 px-5 transition-[height] duration-300 sm:px-8",
          overHero ? "h-[4.75rem]" : "h-16",
        )}
      >
        <Link href="/" aria-label="DesMind Lands, home" className="shrink-0">
          <Logo inverted={overHero} />
        </Link>

        <nav className="mx-auto hidden items-center lg:flex" aria-label="Main">
          {links.map(([href, label]) => {
            const on = active(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={on ? "page" : undefined}
                className={cx(
                  "group plan-label relative flex h-10 items-center gap-2 px-4 text-[11.5px] transition-colors",
                  overHero ? "text-white/80 hover:text-white" : on ? "text-ink" : "text-ink-soft hover:text-ink",
                )}
              >
                <span
                  className={cx(
                    "size-1.5 rounded-full transition",
                    on
                      ? overHero
                        ? "bg-white"
                        : "bg-ink"
                      : "scale-0 bg-current opacity-0 group-hover:scale-100 group-hover:opacity-60",
                  )}
                  aria-hidden="true"
                />
                {label}
                {href === "/dashboard" && !!me?.openDeals && (
                  <span
                    className={cx(
                      "grid h-[18px] min-w-[18px] place-items-center px-1 text-[10px] font-semibold tracking-normal",
                      overHero ? "bg-white text-black" : "bg-ink text-canvas",
                    )}
                  >
                    {me.openDeals}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <ThemeToggle light={overHero} />
          {me ? (
            <div className="hidden items-center gap-1 sm:flex">
              <button
                type="button"
                onClick={leave}
                className={cx(
                  "plan-label h-10 px-3 text-[11.5px] transition-colors",
                  overHero ? "text-white/80 hover:text-white" : "text-ink-soft hover:text-ink",
                )}
              >
                Sign out
              </button>
              <Link
                href="/account"
                title={me.user.fullName}
                className={cx(
                  "grid size-10 place-items-center rounded-full text-[13px] font-semibold",
                  overHero ? "bg-white text-black" : "bg-ink text-canvas",
                )}
              >
                {initials}
              </Link>
            </div>
          ) : (
            <div className="hidden items-center gap-1 sm:flex">
              <Link
                href="/login"
                className={cx(
                  "plan-label flex h-10 items-center px-3 text-[11.5px] transition-colors",
                  overHero ? "text-white/80 hover:text-white" : "text-ink-soft hover:text-ink",
                )}
              >
                Sign in
              </Link>
              <ButtonLink href="/sell" size="md" variant={overHero ? "light" : "primary"} className="ml-2 h-10">
                List your land
                <Icon d={icons.arrow} className="size-4" />
              </ButtonLink>
            </div>
          )}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className={cx("ml-1 flex h-10 items-center gap-2.5 px-2 lg:hidden", overHero ? "text-white" : "text-ink")}
          >
            <span className="plan-label text-[11.5px]">{open ? "Close" : "Menu"}</span>
            <span className="relative block h-2.5 w-6" aria-hidden="true">
              <span
                className={cx(
                  "absolute inset-x-0 h-px bg-current transition-transform duration-300",
                  open ? "top-1/2 rotate-45" : "top-0",
                )}
              />
              <span
                className={cx(
                  "absolute inset-x-0 h-px bg-current transition-transform duration-300",
                  open ? "top-1/2 -rotate-45" : "bottom-0",
                )}
              />
            </span>
          </button>
        </div>
      </div>

      {open && (
        <div className="flex h-[calc(100dvh-4rem)] animate-fade-in flex-col overflow-y-auto border-t border-line bg-canvas px-5 pt-2 pb-8 sm:px-8 lg:hidden">
          <nav className="flex flex-col" aria-label="Main">
            {links.map(([href, label], i) => (
              <Link
                key={href}
                href={href}
                className="flex items-baseline gap-5 border-b border-line py-5 text-ink"
                aria-current={active(href) ? "page" : undefined}
              >
                <span className="plan-label text-ink-faint">0{i + 1}</span>
                <span className="font-display text-[2rem] leading-none">{label}</span>
                {active(href) && <span className="ml-auto size-2 self-center rounded-full bg-ink" aria-hidden="true" />}
              </Link>
            ))}
          </nav>
          <div className="mt-auto grid grid-cols-2 gap-3 pt-8">
            {me ? (
              <>
                <ButtonLink href="/account" variant="secondary">
                  Account
                </ButtonLink>
                <button
                  type="button"
                  onClick={leave}
                  className="h-11 border border-line-strong text-sm font-semibold text-ink"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <ButtonLink href="/login" variant="secondary">
                  Sign in
                </ButtonLink>
                <ButtonLink href="/sell">List your land</ButtonLink>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
