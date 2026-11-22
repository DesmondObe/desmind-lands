import Image from "next/image";
import { cx } from "./ui";

/**
 * The photographs the site is built with, all taken in Enugu State, from Wikimedia Commons
 * under Creative Commons licences, which ask for the credit given on /credits. Each was
 * resized, and its contrast and colour adjusted slightly. They are the only colour on the site.
 *
 * They illustrate the site. They are never shown as a listing's own photo: a listing without
 * photos shows its survey drawing (plot-art.tsx) instead.
 */
export const PHOTOS = {
  "enugu-city": {
    alt: "Enugu city seen from the hills above it",
    place: "Enugu, from the hills",
    author: "DeStrangeImages",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Enugu_Nigeria.jpg",
  },
  "enugu-road": {
    alt: "A tarred road through green land and houses, seen from the air",
    place: "Achi, Oji River, Enugu State",
    author: "Ifeanyichukwu",
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Area_drone_view_of_Achi_1.jpg",
  },
  "enugu-homes": {
    alt: "Houses and compounds along a road, among palm trees, seen from the air",
    place: "Achi, Oji River, Enugu State",
    author: "Ifeanyichukwu",
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Area_drone_view_of_Achi_2.jpg",
  },
  "nsukka-slope": {
    alt: "A grassy hillside of open land, with houses among the trees below it",
    place: "Nsukka, Enugu State",
    author: "MediaMOF",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Nsukka_hilltop_01.jpg",
  },
  "nsukka-homes": {
    alt: "Houses among palm trees, running out to the town under an evening sky",
    place: "Nsukka, Enugu State",
    author: "MediaMOF",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Nsukka_hilltop_29.jpg",
  },
  "nsukka-wide": {
    alt: "Houses scattered through green, wooded land, with flat-topped hills on the horizon",
    place: "Nsukka, Enugu State",
    author: "MediaMOF",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Nsukka_hilltop_19.jpg",
  },
  "nsukka-sky": {
    alt: "Heavy cloud breaking over a town of low houses, seen from a hill",
    place: "Nsukka, Enugu State",
    author: "MediaMOF",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Nsukka_hilltop_36.jpg",
  },
  "nsukka-grass": {
    alt: "An open grass hilltop under a wide sky",
    place: "Nsukka, Enugu State",
    author: "MediaMOF",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Nsukka_hilltop_and_gardens_21.jpg",
  },
  "nsukka-town": {
    alt: "A town of houses among trees, running to the horizon under evening cloud",
    place: "Nsukka, Enugu State",
    author: "MediaMOF",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Nsukka_hilltop_44.jpg",
  },
  "achi-above": {
    alt: "A straight road between compounds and palm trees, seen from directly above",
    place: "Achi, Oji River, Enugu State",
    author: "Ifeanyichukwu",
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Area_drone_view_of_Achi_3.jpg",
  },
  "ngwo-pines": {
    alt: "A footpath running between tall pine trees",
    place: "Ngwo Pine Forest, Enugu",
    author: "Dotun55",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Through_the_pines.jpg",
  },
  "igboeze-hills": {
    alt: "Bare rounded hills of open land, with a flat-topped hill on the horizon",
    place: "Igbo-Eze North, Enugu State",
    author: "Aduragbemio Oladapo",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source:
      "https://commons.wikimedia.org/wiki/File:View_from_the_top_of_a_hill_in_igboeze_north_local_government_of_Enugu_State,_Nigeria.jpg",
  },
  "nike-lake": {
    alt: "Still water reflecting the trees on its far bank",
    place: "Nike Lake, Enugu",
    author: "Nnaemeka Precious Eze",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:The_calm_reflective_surface_of_Nike_Lake.jpg",
  },
  "ngwo-hill": {
    alt: "A wooded hillside with bare tracks cut across it",
    place: "Ngwo, Enugu",
    author: "Philip Emeka",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Enugu_ngwo_hill_2.jpg",
  },
  "iva-valley": {
    alt: "Morning mist lying in a valley of trees and rooftops, under a wooded ridge",
    place: "Iva Valley, Enugu",
    author: "Chibyke1",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Iva_Valley_Enugu_Nigeria.jpg",
  },
} as const;

export type PhotoName = keyof typeof PHOTOS;

/** One of the site's photographs, filling its (positioned) parent. */
export function Photo({
  name,
  className,
  sizes = "100vw",
  eager,
  decorative,
}: {
  name: PhotoName;
  className?: string;
  sizes?: string;
  /** Above the fold: load at once, ahead of other images. */
  eager?: boolean;
  /** Behind text, saying nothing the text does not: hidden from screen readers. */
  decorative?: boolean;
}) {
  return (
    <Image
      src={`/photos/${name}.jpg`}
      alt={decorative ? "" : PHOTOS[name].alt}
      fill
      sizes={sizes}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      className={cx("object-cover", className)}
    />
  );
}

/**
 * A photograph as the ground of a black section, under a black veil so white text stays
 * readable over any part of it. Put it first inside a `relative` section.
 */
export function PhotoGround({ name, eager, className }: { name: PhotoName; eager?: boolean; className?: string }) {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <Photo name={name} eager={eager} decorative className={className} />
      <div className="photo-veil absolute inset-0" />
    </div>
  );
}

/** A photograph in a rounded frame, with where it was taken in the corner. */
export function PhotoTile({
  name,
  className,
  sizes,
  caption = true,
}: {
  name: PhotoName;
  className?: string;
  sizes?: string;
  caption?: boolean;
}) {
  return (
    <figure className={cx("group relative overflow-hidden rounded-4xl bg-forest-950", className)}>
      <Photo name={name} sizes={sizes} className="transition duration-700 ease-out group-hover:scale-[1.03]" />
      {caption && (
        <>
          <div
            className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent"
            aria-hidden="true"
          />
          <figcaption className="absolute bottom-4 left-4 rounded-full bg-black/35 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
            {PHOTOS[name].place}
          </figcaption>
        </>
      )}
    </figure>
  );
}
