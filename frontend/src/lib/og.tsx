import { ImageResponse } from "next/og";

/**
 * The preview card a shared link shows (WhatsApp, X, iMessage): the brand's deep green and
 * brass, a parcel drawn as on a survey plan, and the few facts that matter. Server only.
 * Satori draws it, so: flex layout everywhere, hex colours, no CSS variables.
 */
export const ogSize = { width: 1200, height: 630 };

const FOREST = "#12281F";
const BRASS = "#D2AE62";
const LATERITE = "#C8643B";

export function ogCard({
  eyebrow,
  title,
  price,
  facts = [],
  seal,
}: {
  eyebrow: string;
  title: string;
  price?: string;
  facts?: string[];
  seal?: string;
}) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 64,
        color: "white",
        background: `linear-gradient(135deg, #1D4636 0%, ${FOREST} 55%, #0C1A14 100%)`,
        fontFamily: "sans-serif",
      }}
    >
      {/* The parcel, large and faint, off the right edge. */}
      <svg
        width="560"
        height="560"
        viewBox="0 0 32 32"
        style={{ position: "absolute", right: -70, top: 40, opacity: 0.5 }}
        aria-hidden="true"
      >
        <path d="M8.5 21.5 10.5 9.5l13 2.2 1 11.8-16-2Z" fill={BRASS} fillOpacity="0.1" />
        <path
          d="M8.5 21.5 10.5 9.5l13 2.2 1 11.8-16-2Z"
          fill="none"
          stroke={BRASS}
          strokeWidth="0.35"
          strokeDasharray="1 0.6"
        />
        <circle cx="10.5" cy="9.5" r="0.7" fill="#FFFFFF" />
        <circle cx="23.5" cy="11.7" r="0.7" fill="#FFFFFF" />
        <circle cx="24.5" cy="23.5" r="0.7" fill="#FFFFFF" />
        <circle cx="8.5" cy="21.5" r="0.9" fill={LATERITE} />
      </svg>

      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <svg width="56" height="56" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="0.6" y="0.6" width="30.8" height="30.8" rx="9" fill="none" stroke={BRASS} strokeWidth="1.2" />
          <path
            d="M8.5 21.5 10.5 9.5l13 2.2 1 11.8-16-2Z"
            fill="none"
            stroke={BRASS}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <circle cx="8.5" cy="21.5" r="2.3" fill={LATERITE} />
        </svg>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 600 }}>DesMind</div>
          <div style={{ display: "flex", fontSize: 13, letterSpacing: 8, color: BRASS, fontWeight: 700 }}>LANDS</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", maxWidth: 820 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 20,
            letterSpacing: 4,
            color: BRASS,
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          <div style={{ display: "flex", width: 40, height: 2, background: LATERITE }} />
          {eyebrow}
        </div>
        {price && (
          <div style={{ display: "flex", marginTop: 22, fontSize: 104, fontWeight: 700, lineHeight: 1 }}>{price}</div>
        )}
        <div
          style={{
            display: "flex",
            marginTop: price ? 22 : 26,
            fontSize: price ? 44 : 68,
            fontWeight: price ? 500 : 700,
            lineHeight: 1.15,
            color: price ? "rgba(255,255,255,0.92)" : "white",
          }}
        >
          {title.length > 78 ? `${title.slice(0, 76).trimEnd()}…` : title}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {facts.map((f) => (
            <div
              key={f}
              style={{
                display: "flex",
                padding: "10px 20px",
                borderRadius: 999,
                fontSize: 24,
                background: "rgba(255,255,255,0.09)",
                border: "1px solid rgba(255,255,255,0.16)",
              }}
            >
              {f}
            </div>
          ))}
        </div>
        {seal && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 22px 12px 14px",
              borderRadius: 999,
              fontSize: 24,
              fontWeight: 700,
              color: FOREST,
              background: "white",
            }}
          >
            <svg width="30" height="30" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M10 1.8 3.2 4.4v5.2c0 4.1 2.9 7.1 6.8 8.6 3.9-1.5 6.8-4.5 6.8-8.6V4.4L10 1.8Z" fill="#2F6B52" />
              <path
                d="m6.8 10.1 2.2 2.2 4.3-4.6"
                fill="none"
                stroke="white"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {seal}
          </div>
        )}
      </div>
    </div>,
    ogSize,
  );
}
