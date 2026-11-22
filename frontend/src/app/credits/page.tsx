import type { Metadata } from "next";
import { PHOTOS, Photo, type PhotoName } from "@/components/photo";
import { Page } from "@/components/shell";
import { PageTitle } from "@/components/ui";

export const metadata: Metadata = {
  title: "Photo credits",
  description: "Who took the photographs on DesMind Lands, and the licences they are used under.",
};

export default function Credits() {
  return (
    <Page>
      <PageTitle
        eyebrow="Photo credits"
        title="The photographs, and who took them"
        subtitle="The photographs that illustrate this site were all taken in Enugu State: from the city and its hills to Nsukka, Ngwo, Nike Lake and Achi. They come from Wikimedia Commons, where their authors share them under Creative Commons licences. We resized each one and adjusted its contrast and colour slightly. They are not photos of any land listed here: every listing shows its own."
      />
      <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(PHOTOS) as PhotoName[]).map((name) => {
          const p = PHOTOS[name];
          return (
            <li key={name}>
              <div className="relative aspect-[3/2] overflow-hidden rounded-3xl bg-black">
                <Photo name={name} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
              </div>
              <div className="mt-4 border-t border-ink pt-4 text-sm">
                <p className="font-display text-lg text-ink">{p.place}</p>
                <p className="mt-1 text-ink-soft">
                  Photo by <span className="font-semibold text-ink">{p.author}</span>
                </p>
                <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold">
                  <a href={p.source} target="_blank" rel="noreferrer" className="text-ink underline underline-offset-2">
                    Original on Wikimedia Commons
                  </a>
                  <a
                    href={p.licenceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ink underline underline-offset-2"
                  >
                    {p.licence}
                  </a>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </Page>
  );
}
