import type { ReactNode } from "react";
import { PERIODS, type PeriodId } from "@/lib/admin/intel/periods";
import type { Comparison } from "@/lib/admin/insights";
import type { ViewId } from "./views";
import { Delta, InfoTip, number, StatusPill, timestamp } from "./components";
import styles from "./admin.module.css";

export function viewHref(
  view: ViewId,
  params: Record<string, string | undefined> = {},
) {
  const search = new URLSearchParams();
  if (view !== "overview") search.set("view", view);
  for (const [k, v] of Object.entries(params)) if (v) search.set(k, v);
  const qs = search.toString();
  return qs ? `/admin?${qs}` : "/admin";
}

/** Server-side period selector: plain links, one current item. */
export function PeriodTabs({
  view,
  period,
  extra,
}: {
  view: ViewId;
  period: PeriodId;
  extra?: Record<string, string | undefined>;
}) {
  return (
    <nav className={styles.periodTabs} aria-label="Reporting period">
      {PERIODS.map((p) => (
        <a
          key={p.id}
          href={viewHref(view, { ...extra, period: p.id })}
          aria-current={p.id === period ? "page" : undefined}
        >
          {p.label}
        </a>
      ))}
    </nav>
  );
}

export type ExportReport =
  "subscribers" | "revenue" | "cohorts" | "campaigns" | "coverage";
/** Aggregate-only CSV (see /api/admin/export). A link, not a form: the console stays read-only. */
export function ExportLink({
  report,
  period,
}: {
  report: ExportReport;
  period?: PeriodId;
}) {
  const qs = new URLSearchParams({ report });
  if (period) qs.set("period", period);
  return (
    <a
      className={styles.exportLink}
      href={`/api/admin/export?${qs}`}
      download
      rel="nofollow"
    >
      Download aggregate CSV
    </a>
  );
}

export function NotInstalled({ what }: { what: string }) {
  return (
    <section className={styles.panel} aria-label={`${what} unavailable`}>
      <StatusPill tone="warning">Not installed</StatusPill>
      <p className={styles.missing}>Not yet available</p>
      <p className={styles.detail}>
        {what} needs the Phase 4 analytics migration
        (003_analytics_intelligence.sql) on this database. Nothing is estimated
        in its absence.
      </p>
    </section>
  );
}

/** A figure that is unavailable is never drawn as zero. */
export function AwaitingValue({ reason }: { reason: string }) {
  return (
    <>
      <p className={styles.awaiting}>Awaiting data</p>
      <p className={styles.detail}>{reason}</p>
    </>
  );
}

/** KPI with a comparison against the named equivalent period (or none for all history). */
export function PeriodKpi({
  label,
  value,
  comparison,
  compareLabel,
  upIsGood,
  definition,
  href,
  children,
}: {
  label: string;
  value: number;
  comparison: Comparison | null;
  compareLabel: string;
  upIsGood: boolean;
  definition: ReactNode;
  href?: string;
  children?: ReactNode;
}) {
  return (
    <article className={styles.kpi}>
      <div className={styles.kpiHead}>
        <h3>{label}</h3>
        <InfoTip label={label}>{definition}</InfoTip>
      </div>
      <p className={styles.kpiValue}>{number(value)}</p>
      {comparison ? (
        <Delta
          comparison={comparison}
          period=""
          against={compareLabel}
          upIsGood={upIsGood}
        />
      ) : (
        <p className={styles.detail}>All recorded history · no comparison</p>
      )}
      {children}
      {href && (
        <a className={styles.drill} href={href}>
          Explore <span aria-hidden="true">→</span>
        </a>
      )}
    </article>
  );
}

export function PeriodNote({
  label,
  start,
  compareLabel,
}: {
  label: string;
  start: string | null;
  compareLabel: string;
}) {
  return (
    <p className={styles.lede}>
      {start
        ? `${label}: from ${timestamp(start)} UTC to now`
        : `${label}: every stored record`}
      {compareLabel ? `, compared with the ${compareLabel}.` : "."}
    </p>
  );
}
