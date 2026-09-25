import type { ReactNode } from "react";
import type { Comparison } from "@/lib/admin/insights";
import styles from "./admin.module.css";

export const number = (value: number) =>
  new Intl.NumberFormat("en-GB").format(value);
export const timestamp = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
export const shortDay = (day: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
export const percent = (value: number | null) =>
  value === null ? "—" : `${value}%`;

/** Tap/keyboard-friendly definition popover. Works without JavaScript. */
export function InfoTip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <details className={styles.info}>
      <summary aria-label={`About ${label}`} title={`About ${label}`}>
        <span aria-hidden="true">i</span>
      </summary>
      <div className={styles.infoBody}>{children}</div>
    </details>
  );
}

export function SectionHeading({
  id,
  title,
  meta,
}: {
  id: string;
  title: string;
  meta?: ReactNode;
}) {
  return (
    <div className={styles.sectionHeading}>
      <h2 id={id}>{title}</h2>
      {meta && <span>{meta}</span>}
    </div>
  );
}

export type Tone = "good" | "warning" | "critical" | "neutral";
const toneLabel: Record<Tone, string> = {
  good: "OK",
  warning: "Attention",
  critical: "Problem",
  neutral: "Info",
};
const toneIcon: Record<Tone, string> = {
  good: "✓",
  warning: "!",
  critical: "✕",
  neutral: "•",
};
/** Status always carries an icon and words, never colour alone. */
export function StatusPill({
  tone,
  children,
}: {
  tone: Tone;
  children: ReactNode;
}) {
  return (
    <span className={`${styles.pill} ${styles[`pill_${tone}`]}`}>
      <span aria-hidden="true">{toneIcon[tone]}</span>
      <span className={styles.srOnly}>{toneLabel[tone]}: </span>
      {children}
    </span>
  );
}

export function CoverageTag({ complete }: { complete: boolean }) {
  return (
    <StatusPill tone={complete ? "good" : "warning"}>
      {complete ? "Complete coverage" : "Partial coverage"}
    </StatusPill>
  );
}

/** Signed change against a named period; tone reflects whether up is good. */
export function Delta({
  comparison: c,
  period,
  upIsGood,
  compact = false,
  against,
}: {
  comparison: Comparison;
  period: string;
  upIsGood: boolean;
  /** Full comparison phrase (e.g. "same time yesterday"); defaults to "previous {period}". */
  against?: string;
  /** Table cells: the column states the period; full wording stays for screen readers. */
  compact?: boolean;
}) {
  const tone =
    c.direction === "flat"
      ? styles.deltaFlat
      : (c.direction === "up") === upIsGood
        ? styles.deltaGood
        : styles.deltaBad;
  const arrow = c.direction === "up" ? "▲" : c.direction === "down" ? "▼" : "▬";
  const words =
    c.direction === "flat"
      ? "No change"
      : c.change === null
        ? `${c.direction === "up" ? "Up" : "Down"} from ${number(c.previous)}`
        : `${c.direction === "up" ? "Up" : "Down"} ${Math.abs(c.change)}%`;
  const period_ = `vs ${against ?? `previous ${period}`} (${number(c.previous)})`;
  if (compact)
    return (
      <p className={`${styles.delta} ${tone}`} title={`${words} ${period_}`}>
        <span aria-hidden="true">{arrow}</span> {words}
        <span className={styles.srOnly}> {period_}</span>
      </p>
    );
  return (
    <p className={`${styles.delta} ${tone}`}>
      <span aria-hidden="true">{arrow}</span> {words}{" "}
      <span className={styles.deltaPeriod}>{period_}</span>
    </p>
  );
}

export function Kpi({
  label,
  value,
  detail,
  definition,
  hero = false,
  children,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  definition: ReactNode;
  hero?: boolean;
  children?: ReactNode;
}) {
  return (
    <article className={`${styles.kpi} ${hero ? styles.kpiHero : ""}`}>
      <div className={styles.kpiHead}>
        <h3>{label}</h3>
        <InfoTip label={label}>{definition}</InfoTip>
      </div>
      <p className={styles.kpiValue}>{value}</p>
      {detail && <p className={styles.detail}>{detail}</p>}
      {children}
    </article>
  );
}

export function Unavailable({
  label,
  reason,
}: {
  label: string;
  reason: ReactNode;
}) {
  return (
    <article className={styles.kpi}>
      <div className={styles.kpiHead}>
        <h3>{label}</h3>
      </div>
      <p className={styles.missing}>Not yet available</p>
      <p className={styles.detail}>{reason}</p>
    </article>
  );
}
