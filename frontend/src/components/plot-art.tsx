import { cx } from "./ui";

/** A small seeded random generator, so the same land always draws the same plan. */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (v: number) => Math.round(v * 10) / 10;

const GROUNDS: Record<string, [string, string]> = {
  residential: ["oklch(0.3 0.055 160)", "oklch(0.22 0.04 163)"],
  commercial: ["oklch(0.33 0.05 200)", "oklch(0.22 0.035 200)"],
  agricultural: ["oklch(0.36 0.07 135)", "oklch(0.24 0.05 140)"],
  industrial: ["oklch(0.32 0.03 60)", "oklch(0.22 0.025 60)"],
  mixed: ["oklch(0.34 0.07 40)", "oklch(0.23 0.05 38)"],
};

/**
 * A survey plan of a parcel, drawn from its id: contour lines across the ground, the parcel's
 * boundary with its beacons and their numbers, the length of each side, and a north arrow.
 * Not the real shape of the land: a picture in the language of a plan, for a listing
 * without photos and for the site's own illustrations.
 */
export function PlotArt({
  seed,
  landUse = "residential",
  className,
  animate,
  label,
}: {
  seed: string;
  landUse?: string;
  className?: string;
  animate?: boolean;
  label?: string;
}) {
  const r = seeded(seed);
  const W = 400;
  const H = 300;
  const [g1, g2] = GROUNDS[landUse] ?? GROUNDS.residential!;
  const uid = `p${seed.replace(/[^a-z0-9]/gi, "").slice(0, 10)}`;

  // Contours: gentle waves across the ground, each a little higher than the last.
  const contours = Array.from({ length: 9 }, (_, i) => {
    const y0 = 20 + i * 34 + r() * 10;
    const amp = 8 + r() * 18;
    const phase = r() * Math.PI * 2;
    const pts = Array.from({ length: 9 }, (_, k) => {
      const x = (k / 8) * (W + 40) - 20;
      return `${x.toFixed(1)},${(y0 + Math.sin(phase + k * 0.9) * amp).toFixed(1)}`;
    });
    return `M${pts.join(" L")}`;
  });

  // The parcel: four or five corners around the middle, a little irregular, as land is.
  const n = r() > 0.6 ? 5 : 4;
  const cx0 = W / 2 + (r() - 0.5) * 30;
  const cy0 = H / 2 + (r() - 0.5) * 20;
  const corners = Array.from({ length: n }, (_, i) => {
    const a = -Math.PI * 0.75 + (i / n) * Math.PI * 2 + (r() - 0.5) * 0.35;
    const rad = 70 + r() * 24;
    // Rounded, so the server and the browser draw exactly the same numbers (no hydration mismatch).
    return [round(cx0 + Math.cos(a) * rad * 1.2), round(cy0 + Math.sin(a) * rad * 0.85)] as const;
  });
  const boundary = `M${corners.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L")} Z`;
  const beaconBase = 1000 + Math.floor(r() * 8000);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className={cx("block size-full", className)}
      role="img"
      aria-label={label ?? "Survey plan illustration"}
    >
      <defs>
        <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={g1} />
          <stop offset="1" stopColor={g2} />
        </linearGradient>
        <pattern id={`${uid}-grid`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="white" strokeOpacity="0.05" />
        </pattern>
        <pattern id={`${uid}-hatch`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0V8" stroke="#D2AE62" strokeOpacity="0.18" strokeWidth="2" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#${uid}-g)`} />
      <rect width={W} height={H} fill={`url(#${uid}-grid)`} />
      {contours.map((d, i) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke="white"
          strokeOpacity={i % 3 === 0 ? 0.16 : 0.08}
          strokeWidth={i % 3 === 0 ? 1.1 : 0.8}
        />
      ))}
      <path d={boundary} fill={`url(#${uid}-hatch)`} />
      <path
        d={boundary}
        fill="none"
        stroke="#D2AE62"
        strokeWidth="2"
        strokeLinejoin="round"
        pathLength={animate ? 1 : undefined}
        strokeDasharray={animate ? 1 : undefined}
        className={animate ? "animate-draw" : undefined}
      />
      {corners.map(([x, y], i) => {
        const [nx, ny] = corners[(i + 1) % n]!;
        const len = Math.hypot(nx - x, ny - y) / 6.2;
        const mx = round((x + nx) / 2);
        const my = round((y + ny) / 2);
        const ang = round((Math.atan2(ny - y, nx - x) * 180) / Math.PI);
        const flip = ang > 90 || ang < -90;
        return (
          <g key={`${x}-${y}`}>
            <text
              x={mx}
              y={round(my - 6)}
              transform={`rotate(${round(flip ? ang + 180 : ang)} ${mx} ${my})`}
              textAnchor="middle"
              fontSize="10"
              fontFamily="ui-monospace, monospace"
              fill="white"
              fillOpacity="0.7"
            >
              {len.toFixed(1)}m
            </text>
            <circle cx={x} cy={y} r="5.5" fill={i === 0 ? "#C8643B" : "#F6F1E4"} stroke="#173A2F" strokeWidth="1.5" />
            <text
              x={round(x + (x > cx0 ? 10 : -10))}
              y={round(y + (y > cy0 ? 16 : -9))}
              textAnchor={x > cx0 ? "start" : "end"}
              fontSize="9"
              fontFamily="ui-monospace, monospace"
              fill="#D2AE62"
              letterSpacing="0.5"
            >
              SC/{beaconBase + i * 3}
            </text>
          </g>
        );
      })}
      {/* North arrow */}
      <g transform={`translate(${W - 34} 34)`} opacity="0.85">
        <circle r="15" fill="none" stroke="white" strokeOpacity="0.35" />
        <path d="M0 -11 L4.5 5 L0 2 L-4.5 5 Z" fill="#D2AE62" />
        <text y="-18" textAnchor="middle" fontSize="9" fontWeight="700" fill="white" fillOpacity="0.8">
          N
        </text>
      </g>
    </svg>
  );
}
