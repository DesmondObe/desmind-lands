import { PlotArt } from "@/components/plot-art";
import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 pt-36 sm:px-6 md:grid-cols-2">
      <div className="aspect-[4/3] overflow-hidden rounded-4xl">
        <PlotArt seed="nowhere-404" landUse="mixed" animate />
      </div>
      <div>
        <p className="font-mono text-sm text-earth-600">404 · beacon not found</p>
        <h1 className="mt-3 font-display text-5xl text-ink">This plot is not on the map.</h1>
        <p className="mt-4 text-ink-soft">The page may have moved, or the land has been taken off the market.</p>
        <ButtonLink href="/lands" className="mt-8">
          Browse land for sale
        </ButtonLink>
      </div>
    </div>
  );
}
