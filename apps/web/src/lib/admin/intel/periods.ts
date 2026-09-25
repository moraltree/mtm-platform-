/**
 * Phase 4 reporting periods. Current window is [start, end] (end = the
 * snapshot instant); the comparison window is [prevStart, prevEnd) and has
 * exactly the same elapsed length, so a partial day or month is always
 * compared with an equally partial one. "All history" has no comparison.
 */
export const PERIODS = [
  { id: "today", label: "Today", compare: "same time yesterday" },
  { id: "7d", label: "7 days", compare: "previous 7 days" },
  { id: "30d", label: "30 days", compare: "previous 30 days" },
  { id: "90d", label: "90 days", compare: "previous 90 days" },
  { id: "mtd", label: "Month to date", compare: "same point last month" },
  { id: "all", label: "All history", compare: "" },
] as const;
export type PeriodId = (typeof PERIODS)[number]["id"];

export interface PeriodWindow {
  id: PeriodId;
  label: string;
  compareLabel: string;
  start: Date | null;
  end: Date;
  prevStart: Date | null;
  prevEnd: Date | null;
}

const DAY = 86_400_000;
const utcMidnight = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export function parsePeriod(value: unknown, fallback: PeriodId = "30d") {
  const candidate = Array.isArray(value) ? value[0] : value;
  return PERIODS.find((p) => p.id === candidate)?.id ?? fallback;
}

export function periodWindow(id: PeriodId, now: Date): PeriodWindow {
  if (!Number.isFinite(now.getTime()))
    throw new Error("Invalid reporting date");
  const meta = PERIODS.find((p) => p.id === id)!;
  const base = { id, label: meta.label, compareLabel: meta.compare, end: now };
  if (id === "all")
    return { ...base, start: null, prevStart: null, prevEnd: null };
  if (id === "today") {
    const start = utcMidnight(now);
    return {
      ...base,
      start,
      prevStart: new Date(start.getTime() - DAY),
      prevEnd: new Date(now.getTime() - DAY),
    };
  }
  if (id === "mtd") {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const prevStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
    );
    // Same elapsed time into the previous month, clamped to its end.
    const elapsed = now.getTime() - start.getTime();
    const prevEnd = new Date(
      Math.min(prevStart.getTime() + elapsed, start.getTime()),
    );
    return { ...base, start, prevStart, prevEnd };
  }
  const days = { "7d": 7, "30d": 30, "90d": 90 }[id];
  const start = new Date(now.getTime() - days * DAY);
  return {
    ...base,
    start,
    prevStart: new Date(start.getTime() - days * DAY),
    prevEnd: start,
  };
}

/** Fixed calendar revenue windows (UTC; week starts Monday). */
export function calendarWindows(now: Date) {
  const today = utcMidnight(now);
  const week = new Date(today);
  week.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  return {
    today,
    week,
    month: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    year: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)),
  };
}

/** SQL-safe bounds: an open start becomes -infinity; no comparison is an empty window. */
export const NEG_INFINITY = "-infinity";
export function sqlBounds(w: PeriodWindow) {
  return {
    start: w.start ?? NEG_INFINITY,
    end: w.end,
    prevStart: w.prevStart ?? NEG_INFINITY,
    prevEnd: w.prevEnd ?? NEG_INFINITY,
  };
}
