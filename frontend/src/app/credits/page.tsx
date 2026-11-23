import type { Metadata } from "next";
import { PHOTOS, type PhotoName } from "@/components/photo";
import { Prose } from "@/components/prose";

export const metadata: Metadata = {
  title: "Photographs",
  robots: { index: false },
};

/** The credit the photographs' licences ask for, kept as a plain list off the main pages. */
export default function Credits() {
  return (
    <Prose eyebrow="Acknowledgements" title="Photographs" updated="23 November 2026">
      <p>
        The photographs on this site are used under licence, with thanks to the people who took them. Each has been
        cropped and adjusted.
      </p>
      <ul className="!mt-8 border-b border-line text-[15px] leading-relaxed">
        {(Object.keys(PHOTOS) as PhotoName[]).map((name) => {
          const p = PHOTOS[name];
          return (
            <li key={name} className="flex flex-wrap items-baseline justify-between gap-x-6 border-t border-line py-3">
              <span>
                <a href={p.source} target="_blank" rel="noreferrer" className="text-ink underline underline-offset-2">
                  {p.place}
                </a>
                , by {p.author}
              </span>
              <a href={p.licenceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                {p.licence}
              </a>
            </li>
          );
        })}
      </ul>
    </Prose>
  );
}
