/**
 * Pure Phase 3 presentation rules: UTC day series, fair period comparisons
 * and funnel shares. No database, provider or environment access.
 */
export const SERIES = [
  "registrations",
  "trial_starts",
  "conversions",
  "new_paid",
  "cancellations",
  "payments",
  "failed_payments",
] as const;
export type SeriesKey = (typeof SERIES)[number];
export interface DayPoint {
  /** UTC date, YYYY-MM-DD. */
  day: string;
  value: number;
  /** Today's bucket is still accumulating. */
  partial: boolean;
}
export interface Comparison {
  current: number;
  previous: number;
  /** Percentage change, or null when the previous period is zero. */
  change: number | null;
  direction: "up" | "down" | "flat";
}
/** Whether an increase is good news for the founder (drives delta tone, never the value). */
export const UP_IS_GOOD: Record<SeriesKey, boolean> = {
  registrations: true,
  trial_starts: true,
  conversions: true,
  new_paid: true,
  cancellations: false,
  payments: true,
  failed_payments: false,
};

export const SERIES_DAYS = 30;

export function utcDay(date: Date, offsetDays = 0) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + offsetDays,
    ),
  );
}
export const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/** The first instant of the oldest day in a series ending today (UTC). */
export function seriesStart(now: Date, days = SERIES_DAYS) {
  return utcDay(now, -(days - 1));
}

/** Zero-fills a sparse day→value map into exactly `days` consecutive UTC days ending today. */
export function fillDays(
  values: Map<string, number>,
  now: Date,
  days = SERIES_DAYS,
): DayPoint[] {
  const today = isoDay(utcDay(now));
  return Array.from({ length: days }, (_, i) => {
    const day = isoDay(utcDay(now, i - (days - 1)));
    return { day, value: values.get(day) ?? 0, partial: day === today };
  });
}

export function compare(current: number, previous: number): Comparison {
  return {
    current,
    previous,
    change:
      previous > 0
        ? Math.round(((current - previous) / previous) * 1000) / 10
        : null,
    direction: current > previous ? "up" : current < previous ? "down" : "flat",
  };
}

/** Coverage of a UTC day against a dataset start instant. */
export function dayCoverage(
  day: string,
  start: Date,
): "none" | "partial" | "full" {
  const dayStart = new Date(`${day}T00:00:00Z`).getTime();
  const dayEnd = dayStart + 86_400_000;
  if (start.getTime() <= dayStart) return "full";
  return start.getTime() < dayEnd ? "partial" : "none";
}

export function share(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

/** Clean upper bound for a y-axis: 1, 2, 5 × 10ⁿ at or above the maximum. */
export function niceMax(max: number) {
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 5, 10])
    if (step * magnitude >= max) return step * magnitude;
  return 10 * magnitude;
}
