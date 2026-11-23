import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  ComponentProps,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

type Variant = "primary" | "earth" | "secondary" | "danger" | "ghost" | "light";
type Size = "sm" | "md" | "lg";

const buttonBase =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold tracking-tight transition-[background-color,border-color,color,box-shadow,transform] duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";

const buttonVariant: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary shadow-soft ring-1 ring-inset ring-white/10 hover:bg-primary-hover hover:shadow-card",
  earth: "bg-black text-white shadow-soft ring-1 ring-inset ring-white/15 hover:bg-neutral-800 hover:shadow-lift",
  secondary: "border border-line-strong bg-surface text-ink shadow-soft hover:border-ink hover:bg-sunken",
  danger: "bg-danger text-white shadow-soft hover:brightness-110",
  ghost: "text-ink-soft hover:bg-sunken hover:text-ink",
  light: "bg-white text-black shadow-soft hover:bg-neutral-200",
};

const buttonSize: Record<Size, string> = {
  sm: "h-9 px-4 text-[13px]",
  md: "h-11 px-5 text-[14px]",
  lg: "h-13 px-7 text-[15px]",
};

export const buttonClass = (variant: Variant = "primary", size: Size = "md", className?: string) =>
  cx(buttonBase, buttonVariant[variant], buttonSize[size], className);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; busy?: boolean };

export function Button({
  variant = "primary",
  size = "md",
  className,
  busy,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button {...props} disabled={disabled || busy} className={buttonClass(variant, size, className)}>
      {busy && <Spinner />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link {...props} className={buttonClass(variant, size, className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cx("size-4 animate-spin", className)} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const fieldClass =
  "w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-[15px] text-ink shadow-[0_1px_1px_oklch(0_0_0/0.04)] outline-none transition placeholder:text-ink-faint hover:border-ink-faint/60 focus:border-ink focus:ring-4 focus:ring-ink/10 disabled:bg-sunken disabled:text-ink-soft";

export const Input = (props: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={cx(fieldClass, props.className)} />
);
export const Textarea = (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...props} className={cx(fieldClass, "min-h-28 leading-relaxed", props.className)} />
);
export const Select = (props: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} className={cx(fieldClass, "cursor-pointer pr-9", props.className)} />
);

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control arrives as children, inside the label.
    <label className="block space-y-1.5">
      <span className="text-[13px] font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="block text-xs leading-relaxed text-ink-faint">{hint}</span>}
    </label>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-3xl border border-line bg-surface p-6 shadow-card", className)}>{children}</div>;
}

type Tone = "good" | "wait" | "bad" | "quiet" | "info" | "earth";
const toneClass: Record<Tone, [string, string]> = {
  // Told apart by weight, not hue: solid ink, an ink outline, a soft outline, grey. Red is for trouble.
  good: ["bg-ink text-canvas", "bg-canvas"],
  wait: ["bg-sunken text-ink ring-1 ring-inset ring-line-strong", "bg-ink"],
  bad: ["bg-red-100 text-red-800", "bg-red-500"],
  quiet: ["bg-sunken text-ink-faint", "bg-ink-faint"],
  info: ["bg-surface text-ink ring-1 ring-inset ring-ink", "bg-ink"],
  earth: ["bg-surface text-ink ring-1 ring-inset ring-line-strong", "bg-ink-soft"],
};

export function Badge({ tone = "quiet", live, children }: { tone?: Tone; live?: boolean; children: ReactNode }) {
  const [pill, dot] = toneClass[tone];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full py-1 pr-3 pl-2.5 text-xs font-semibold whitespace-nowrap",
        pill,
      )}
    >
      <span className={cx("size-1.5 rounded-full", dot, live && "animate-pulse-dot")} aria-hidden="true" />
      {children}
    </span>
  );
}

export const statusTone: Record<string, Tone> = {
  draft: "quiet",
  in_review: "wait",
  published: "good",
  under_offer: "earth",
  sold: "info",
  withdrawn: "quiet",
  rejected: "bad",
  negotiating: "wait",
  checks: "earth",
  agreement: "earth",
  payment: "info",
  completed: "good",
  cancelled: "quiet",
};

export function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className="flex animate-fade-in items-start gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 size-4 shrink-0" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-12a.9.9 0 0 1 .9.9v3.6a.9.9 0 1 1-1.8 0V6.9A.9.9 0 0 1 10 6Zm0 8.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        />
      </svg>
      {error}
    </p>
  );
}

/** A small uppercase label above a heading, opened by a short rule. */
export function Eyebrow({ children, className, light }: { children: ReactNode; className?: string; light?: boolean }) {
  return (
    <p
      className={cx(
        "flex items-center gap-3 text-[11px] font-bold tracking-[0.24em] uppercase",
        light ? "text-white/80" : "text-ink-soft",
        className,
      )}
    >
      <span className={cx("h-px w-8", light ? "bg-white/70" : "bg-ink")} aria-hidden="true" />
      {children}
    </p>
  );
}

export function PageTitle({
  title,
  subtitle,
  action,
  eyebrow,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-10 flex animate-rise flex-wrap items-end justify-between gap-5">
      <div>
        {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
        <h1 className="font-display text-3xl leading-[1.1] font-normal text-ink sm:text-[2.5rem]">{title}</h1>
        {subtitle && <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl bg-sunken px-6 py-14 text-center">
      <svg viewBox="0 0 48 48" fill="none" className="size-11 text-ink" aria-hidden="true">
        <path d="M8 34 14 12l22 4 4 20-32-2Z" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 3" />
        {[
          [8, 34],
          [14, 12],
          [36, 16],
          [40, 36],
        ].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r="2.6" fill="currentColor" />
        ))}
      </svg>
      <p className="text-lg font-semibold tracking-tight text-ink">{title}</p>
      {children && <div className="max-w-sm text-sm leading-relaxed text-ink-soft">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/**
 * The DesMind Lands mark: a parcel of land drawn as on a survey plan, with its corner beacons,
 * the first of them larger, on an ink tile. `inverted` is the outline version for black grounds.
 */
export function LogoMark({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={cx("size-8 shrink-0", className)} aria-hidden="true">
      {inverted ? (
        <rect x="0.6" y="0.6" width="30.8" height="30.8" rx="9" fill="none" stroke="#FFFFFF" strokeWidth="1.2" />
      ) : (
        <rect width="32" height="32" rx="9" fill="var(--color-ink)" />
      )}
      <g
        fill={inverted ? "#FFFFFF" : "var(--color-canvas)"}
        stroke={inverted ? "#FFFFFF" : "var(--color-canvas)"}
        strokeLinejoin="round"
      >
        <path d="M8.5 21.5 10.5 9.5l13 2.2 1 11.8-16-2Z" fillOpacity="0.14" strokeWidth="1.3" />
        <circle cx="10.5" cy="9.5" r="1.5" stroke="none" />
        <circle cx="23.5" cy="11.7" r="1.5" stroke="none" />
        <circle cx="24.5" cy="23.5" r="1.5" stroke="none" />
        <circle cx="8.5" cy="21.5" r="2.5" stroke="none" />
      </g>
    </svg>
  );
}

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <LogoMark inverted={inverted} />
      <span className="flex flex-col leading-none">
        <span
          className={cx(
            "font-display text-[19px] font-medium tracking-[-0.01em]",
            inverted ? "text-white" : "text-ink",
          )}
        >
          DesMind
        </span>
        <span
          className={cx(
            "mt-1 pl-px text-[8.5px] font-extrabold tracking-[0.55em]",
            inverted ? "text-white/70" : "text-ink-soft",
          )}
        >
          LANDS
        </span>
      </span>
    </span>
  );
}

/**
 * The seal on land whose title DesMind searched at the State Ministry of Lands: a shield and
 * tick, and the words. `compact` is for cards and photos; `light` for dark grounds.
 */
export function TitleSearchSeal({
  at,
  compact,
  light,
  className,
}: {
  at?: string | null;
  compact?: boolean;
  light?: boolean;
  className?: string;
}) {
  const day = at ? new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;
  if (compact)
    return (
      <span
        className={cx(
          "inline-flex items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1.5 text-[11px] font-bold whitespace-nowrap",
          light
            ? "bg-white/95 text-black shadow-soft backdrop-blur [--tick:white]"
            : "bg-ink text-canvas [--tick:var(--color-ink)]",
          className,
        )}
      >
        <ShieldTick className="size-4" />
        Title searched
      </span>
    );
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <span
        className={cx(
          "grid size-9 shrink-0 place-items-center rounded-xl",
          light
            ? "bg-white/10 text-white ring-1 ring-white/20 [--tick:black]"
            : "bg-ink text-canvas [--tick:var(--color-ink)]",
        )}
      >
        <ShieldTick className="size-5" />
      </span>
      <span className="leading-tight">
        <span className={cx("block text-[13px] font-bold", light ? "text-white" : "text-ink")}>
          Title searched at the Ministry of Lands
        </span>
        <span className={cx("block text-xs", light ? "text-white/60" : "text-ink-faint")}>
          {day ? `By DesMind Lands, ${day}` : "By DesMind Lands, before listing"}
        </span>
      </span>
    </span>
  );
}

function ShieldTick({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <path d="M10 1.8 3.2 4.4v5.2c0 4.1 2.9 7.1 6.8 8.6 3.9-1.5 6.8-4.5 6.8-8.6V4.4L10 1.8Z" fill="currentColor" />
      <path
        d="m6.8 10.1 2.2 2.2 4.3-4.6"
        fill="none"
        stroke="var(--tick, white)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A thin line icon, drawn on a 20-unit grid. */
export function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx("size-5", className)}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

export const icons = {
  pin: "M10 17.5s5.5-5 5.5-9.5a5.5 5.5 0 1 0-11 0c0 4.5 5.5 9.5 5.5 9.5Zm0-7.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  ruler: "m3 13 10-10 4 4-10 10-4-4Zm3 0 1.5 1.5M8 11l1.5 1.5M10 9l1.5 1.5M12 7l1.5 1.5",
  doc: "M5.5 2.5h6l3 3v12h-9v-15Zm6 0v3h3M8 10h5M8 13h5",
  shield: "M10 2.5 3.5 5v5c0 3.9 2.8 6.7 6.5 7.5 3.7-.8 6.5-3.6 6.5-7.5V5L10 2.5Zm-3 7.7 2.1 2.1 4-4.3",
  pen: "M13.5 3.5 16.5 6.5 7 16H4v-3l9.5-9.5ZM3 18.5h14",
  users:
    "M7.5 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 17c0-3 2.5-5 5.5-5s5.5 2 5.5 5M13.5 3.2a3 3 0 0 1 0 5.6M15 12.3c1.8.6 3 2.3 3 4.7",
  coins:
    "M8 7c3.3 0 6-1.1 6-2.5S11.3 2 8 2 2 3.1 2 4.5 4.7 7 8 7ZM2 4.5v4C2 9.9 4.7 11 8 11s6-1.1 6-2.5v-4M6 13c.6.6 1.9 1 3.5 1M12 9.5c3.3 0 6 1.1 6 2.5v3.5c0 1.4-2.7 2.5-6 2.5s-6-1.1-6-2.5V12",
  key: "M12.5 8.5a4 4 0 1 0-3.6 4L3 18.5V16h2.5v-2.5H8l1-1M13.5 6.5h.01",
  heart: "M10 16.5S3 12.4 3 7.7A3.7 3.7 0 0 1 10 6a3.7 3.7 0 0 1 7 1.7c0 4.7-7 8.8-7 8.8Z",
  check: "m4.5 10.5 3.5 3.5 7.5-8",
  arrow: "M4 10h12m-5-5 5 5-5 5",
  search: "m17 17-4-4m1.5-4.5a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z",
  eye: "M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10Zm8 2.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z",
  chat: "M3 4.5h14v9H8l-4 3v-3H3v-9Z",
  calendar: "M3.5 5.5h13v11h-13zM3.5 9h13M7 3v3M13 3v3",
  bank: "M3 8h14M10 3l7 4H3l7-4ZM4.5 8v7m3.5-7v7m4-7v7m3.5-7v7M3 17.5h14",
  upload: "M10 13V3m-4 4 4-4 4 4M3.5 13v3.5h13V13",
  x: "M5 5l10 10M15 5 5 15",
  compass: "M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm2.8-10.8-1.6 4.4-4 1.6 1.6-4.4 4-1.6Z",
  plus: "M10 4v12M4 10h12",
  link: "M8.5 11.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-.9.9M11.5 8.5a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 0 0 4.2 4.2l.9-.9",
};
