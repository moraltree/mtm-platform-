import "server-only";
import type { PoolClient } from "pg";
import { toMinor } from "./finance";
import {
  compare,
  dayCoverage,
  fillDays,
  SERIES,
  seriesStart,
  type Comparison,
  type DayPoint,
  type SeriesKey,
} from "./insights";
import {
  comparisonSql,
  dailySeriesSql,
  feedSql,
  funnelSql,
  openGapsSql,
  revenueSeriesSql,
  webhookRecencySql,
} from "./insightsQueries";

export type FeedKind =
  | "registration"
  | "trial_started"
  | "conversion"
  | "new_paid"
  | "payment"
  | "payment_failed"
  | "cancellation"
  | "refund"
  | "dispute";
export interface RevenueDay {
  day: string;
  grossMinor: number;
  payments: number;
  coverage: "none" | "partial" | "full";
  partial: boolean;
}
export interface Insights {
  /** Earliest stored account: the start of every event-based trend. */
  dataStart: string | null;
  series: Record<SeriesKey, DayPoint[]>;
  comparisons: Record<SeriesKey, { d7: Comparison; d30: Comparison }>;
  everPaid: number;
  webhook: { last24h: number; last7d: number };
  /** Null when the Phase 2 ledger is not installed. */
  openGaps: number | null;
  revenueSeries: { currency: string; days: RevenueDay[] }[] | null;
  feed: { kind: FeedKind; at: string }[];
}

/** Runs inside the caller's read-only repeatable-read transaction. */
export async function readInsights(
  db: PoolClient,
  now: Date,
  ledgerStart: Date | null,
): Promise<Insights> {
  const from = seriesStart(now);
  const daily = (await db.query(dailySeriesSql, [now, from])).rows;
  const series = Object.fromEntries(
    SERIES.map((key) => [
      key,
      fillDays(
        new Map(daily.filter((r) => r.metric === key).map((r) => [r.day, r.n])),
        now,
      ),
    ]),
  ) as Record<SeriesKey, DayPoint[]>;
  const compared = new Map(
    (await db.query(comparisonSql, [now])).rows.map((r) => [r.metric, r]),
  );
  const comparisons = Object.fromEntries(
    SERIES.map((key) => {
      const r = compared.get(key);
      return [
        key,
        {
          d7: compare(r?.cur7 ?? 0, r?.prev7 ?? 0),
          d30: compare(r?.cur30 ?? 0, r?.prev30 ?? 0),
        },
      ];
    }),
  ) as Insights["comparisons"];
  const funnel = (await db.query(funnelSql, [now])).rows[0];
  const webhook = (await db.query(webhookRecencySql, [now])).rows[0];

  let openGaps: number | null = null;
  let revenueSeries: Insights["revenueSeries"] = null;
  if (ledgerStart) {
    openGaps = (await db.query(openGapsSql, [now])).rows[0]?.open ?? 0;
    const rows = (await db.query(revenueSeriesSql, [now, from])).rows;
    const currencies = [...new Set(rows.map((r) => r.currency as string))];
    revenueSeries = currencies.sort().map((currency) => {
      const byDay = new Map(
        rows.filter((r) => r.currency === currency).map((r) => [r.day, r]),
      );
      return {
        currency,
        days: fillDays(new Map(), now).map((point) => ({
          day: point.day,
          grossMinor: toMinor(byDay.get(point.day)?.gross ?? 0),
          payments: byDay.get(point.day)?.payments ?? 0,
          coverage: dayCoverage(point.day, ledgerStart),
          partial: point.partial,
        })),
      };
    });
  }
  const feed = (await db.query(feedSql, [now])).rows
    .filter((r) => r.kind)
    .map((r) => ({
      kind: r.kind as FeedKind,
      at: r.occurred_at.toISOString(),
    }));
  return {
    dataStart: funnel?.data_start ? funnel.data_start.toISOString() : null,
    series,
    comparisons,
    everPaid: funnel?.ever_paid ?? 0,
    webhook: {
      last24h: webhook?.last24h ?? 0,
      last7d: webhook?.last7d ?? 0,
    },
    openGaps,
    revenueSeries,
    feed,
  };
}
