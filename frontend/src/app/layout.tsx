import type { Metadata, Viewport } from "next";
import { Fraunces, Geist_Mono, Manrope } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { Nav } from "@/components/nav";
import { PhotoGround } from "@/components/photo";
import { SessionProvider } from "@/components/session";
import { Toaster } from "@/components/toast";
import { Logo } from "@/components/ui";
import { contact, siteUrl } from "@/lib/site";
import { themeBootScript } from "@/lib/theme";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", axes: ["SOFT", "opsz"] });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "DesMind Lands: sell land directly, no agents", template: "%s · DesMind Lands" },
  description:
    "Buy and sell land directly between owner and buyer, with no agent and no commission. Offers, checks, a signed and witnessed agreement, and every payment on record.",
  applicationName: "DesMind Lands",
  openGraph: {
    type: "website",
    siteName: "DesMind Lands",
    locale: "en_NG",
    title: "DesMind Lands: sell your land. Keep every naira.",
    description: "Land sold directly, owner to buyer, with witnesses and a signed agreement. No agents, no 10% cut.",
    url: "/",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#0A0A0A" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${manrope.variable} ${geistMono.variable} ${fraunces.variable}`}
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static theme boot script, must run before paint. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="flex flex-col">
        <SessionProvider>
          <Toaster />
          <Nav />
          <main className="flex-1">{children}</main>
          <Footer />
        </SessionProvider>
      </body>
    </html>
  );
}

function Footer() {
  const columns: [string, [string, string][]][] = [
    [
      "Buyers",
      [
        ["/lands", "Land for sale"],
        ["/how-it-works#buyers", "How buying works"],
        ["/how-it-works#title-search", "Our title search"],
        ["/how-it-works#checks", "Checks before you pay"],
      ],
    ],
    [
      "Sellers",
      [
        ["/sell", "List your land"],
        ["/dashboard", "Dashboard"],
        ["/how-it-works#sellers", "How selling works"],
      ],
    ],
    [
      "DesMind Lands",
      [
        ["/how-it-works#witnesses", "Witnesses"],
        ["/terms", "Terms of use"],
        ["/privacy", "Privacy"],
        ["/credits", "Photo credits"],
      ],
    ],
  ];
  return (
    <footer className="deep-ground relative mt-24 overflow-hidden border-t border-white/10 text-white/70 print:hidden">
      <PhotoGround name="nsukka-grass" />
      <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-10 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div className="space-y-6">
            <Logo inverted />
            <p className="max-w-sm font-display text-2xl leading-snug text-white">
              Land, sold directly. <span className="italic">No agents. No 10% cut.</span>
            </p>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/6 px-3 py-1.5 text-xs font-semibold text-white/75 ring-1 ring-white/10">
              <span className="size-1.5 rounded-full bg-white" aria-hidden="true" />
              Now serving all 17 LGAs of Enugu State. More of Nigeria soon.
            </p>
            <div className="space-y-1.5 text-sm">
              <a href={`mailto:${contact.email}`} className="block text-white/80 hover:text-white">
                {contact.email}
              </a>
              <p>{contact.phone}</p>
              <p className="text-white/50">{contact.office}</p>
            </div>
          </div>
          {columns.map(([title, links]) => (
            <div key={title}>
              <h2 className="mb-5 text-[11px] font-bold tracking-[0.22em] text-white/55 uppercase">{title}</h2>
              <ul className="space-y-3 text-sm">
                {links.map(([href, label]) => (
                  <li key={label}>
                    <Link href={href} className="text-white/65 transition hover:text-white">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-16 border-t border-white/10 pt-8 text-xs leading-relaxed text-white/45">
          © {new Date().getFullYear()} {contact.company}. DesMind Lands is a technology platform on which owners and
          buyers deal directly. It is not an estate agent and holds no money. We search every title at the Enugu State
          Ministry of Lands before the land is listed; a search reports what the Ministry's records show on the day, and
          is not a guarantee of title. Always inspect the land and take independent legal advice before you pay.
        </div>
      </div>
    </footer>
  );
}
