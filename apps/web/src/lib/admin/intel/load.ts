import "server-only";
import type { PoolClient } from "pg";
import { toMinor, windowCoverage, mrrStatus, type Coverage } from "../finance";
import { mrrSql } from "../financeQueries";
import { compare, type Comparison } from "../insights";
import {
  calendarWindows,
  periodWindow,
  type PeriodId,
  type PeriodWindow,
} from "./periods";
import {
  campaignKey,
  countryName,
  evaluateCoverage,
  MIN_GROUP,
  suppress,
  type CoverageDomain,
  type Inventory,
} from "./rules";
import * as q from "./queries";

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const OPEN = "-infinity";
const FOREVER = "infinity";
const WEEK = 7 * 86_400_000;

export interface PeriodInfo {
  id: PeriodId;
  label: string;
  compareLabel: string;
  start: string | null;
  end: string;
  prevStart: string | null;
  prevEnd: string | null;
}
const info = (w: PeriodWindow): PeriodInfo => ({
  id: w.id,
  label: w.label,
  compareLabel: w.compareLabel,
  start: iso(w.start),
  end: w.end.toISOString(),
  prevStart: iso(w.prevStart),
  prevEnd: iso(w.prevEnd),
});

export async function coverageStarts(db: PoolClient) {
  return new Map<string, Date>(
    (await db.query(q.coverageRowsSql)).rows.map((r) => [
      r.dataset,
      r.coverage_start,
    ]),
  );
}

/* ---------------- Subscribers ---------------- */
export const SUBSCRIBER_METRICS = [
  "registrations",
  "trial_starts",
  "conversions",
  "new_paid",
  "new_paid_accounts",
  "reactivations",
  "cancellations",
  "payments",
  "failed_payments",
] as const;
export type SubscriberMetric = (typeof SUBSCRIBER_METRICS)[number];
export interface SubscriberIntel {
  period: PeriodInfo;
  metrics: Record<
    SubscriberMetric,
    { current: number; comparison: Comparison | null }
  >;
  netSubscriptions: { current: number; previous: number | null };
  scheduled: { accountsNow: number; inPeriod: number | null };
  history:
    | {
        status: "available";
        opening: number;
        closing: number;
        gained: number;
        lost: number;
      }
    | { status: "unavailable"; historyStart: string | null };
  weekly: Record<
    "registrations" | "trial_starts" | "new_paid" | "cancellations",
    { week: string; value: number; partial: boolean }[]
  >;
}

export async function loadSubscribers(
  db: PoolClient,
  now: Date,
  period: PeriodId,
  starts: Map<string, Date>,
): Promise<SubscriberIntel> {
  const w = periodWindow(period, now);
  const hasPrev = w.prevStart !== null;
  const rows = new Map(
    (
      await db.query(q.subscriberPeriodSql, [
        w.start ?? OPEN,
        now,
        w.prevStart ?? OPEN,
        w.prevEnd ?? OPEN,
      ])
    ).rows.map((r) => [r.metric, r]),
  );
  const metrics = Object.fromEntries(
    SUBSCRIBER_METRICS.map((m) => {
      const r = rows.get(m);
      return [
        m,
        {
          current: r?.cur ?? 0,
          comparison: hasPrev ? compare(r?.cur ?? 0, r?.prev ?? 0) : null,
        },
      ];
    }),
  ) as SubscriberIntel["metrics"];
  const net = (key: "cur" | "prev") =>
    (rows.get("new_paid")?.[key] ?? 0) -
    (rows.get("cancellations")?.[key] ?? 0);

  const historyStart = starts.get("subscription_history") ?? null;
  const covered =
    historyStart !== null &&
    w.start !== null &&
    w.start.getTime() >= historyStart.getTime();
  const sched = (await db.query(q.scheduledSql, [w.start ?? OPEN, now]))
    .rows[0];
  let history: SubscriberIntel["history"] = {
    status: "unavailable",
    historyStart: iso(historyStart),
  };
  if (covered) {
    const h = (await db.query(q.historyMovementSql, [w.start, now])).rows[0];
    history = { status: "available", ...h };
  }

  // Twelve ISO weeks ending with the current (partial) week.
  const thisWeek = calendarWindows(now).week;
  const from = new Date(thisWeek.getTime() - 11 * WEEK);
  const weeklyRows = (await db.query(q.weeklySql, [from, now])).rows;
  const weekly = Object.fromEntries(
    (
      ["registrations", "trial_starts", "new_paid", "cancellations"] as const
    ).map((m) => [
      m,
      Array.from({ length: 12 }, (_, i) => {
        const week = new Date(from.getTime() + i * WEEK)
          .toISOString()
          .slice(0, 10);
        return {
          week,
          value:
            weeklyRows.find((r) => r.metric === m && r.week === week)?.n ?? 0,
          partial: i === 11,
        };
      }),
    ]),
  ) as SubscriberIntel["weekly"];

  return {
    period: info(w),
    metrics,
    netSubscriptions: {
      current: net("cur"),
      previous: hasPrev ? net("prev") : null,
    },
    scheduled: {
      accountsNow: sched?.accounts_now ?? 0,
      inPeriod: covered ? (sched?.scheduled_in_window ?? 0) : null,
    },
    history,
    weekly,
  };
}

/* ---------------- Revenue ---------------- */
export interface CurrencyMoney {
  currency: string;
  payments: number;
  grossMinor: number;
  netMinor: number;
  refundedMinor: number;
  disputesLostMinor: number;
  newMinor: number;
  renewalMinor: number;
  otherMinor: number;
  unclassifiedMinor: number;
  monthlyMinor: number;
  annualMinor: number;
}
export interface FailureMoney {
  currency: string;
  invoices: number;
  failedMinor: number;
  recoveredMinor: number;
  outstandingMinor: number;
}
export interface RevenueWindowIntel {
  name: string;
  label: string;
  start: string | null;
  coverage: Coverage;
  currencies: CurrencyMoney[];
  failures: FailureMoney[];
}
export interface RevenueIntel {
  period: PeriodInfo;
  ledgerStart: string | null;
  billingReasonStart: string | null;
  failuresStart: string | null;
  windows: RevenueWindowIntel[];
  mrr: {
    status: "available" | "partial" | "unavailable";
    paying: number;
    priced: number;
    currencies: {
      currency: string;
      mrrMinor: number;
      cancelingMinor: number;
    }[];
  };
}

export async function loadRevenue(
  db: PoolClient,
  now: Date,
  period: PeriodId,
  starts: Map<string, Date>,
): Promise<RevenueIntel> {
  const w = periodWindow(period, now);
  const cal = calendarWindows(now);
  const defs: {
    name: string;
    label: string;
    s: Date | string;
    e: Date | string;
  }[] = [
    { name: "today", label: "Revenue today", s: cal.today, e: FOREVER },
    { name: "week", label: "This week", s: cal.week, e: FOREVER },
    { name: "month", label: "This month", s: cal.month, e: FOREVER },
    { name: "year", label: "Year to date", s: cal.year, e: FOREVER },
    { name: "lifetime", label: "Lifetime recorded", s: OPEN, e: FOREVER },
    { name: "current", label: w.label, s: w.start ?? OPEN, e: FOREVER },
  ];
  if (w.prevStart && w.prevEnd)
    defs.push({
      name: "previous",
      label: w.compareLabel,
      s: w.prevStart,
      e: w.prevEnd,
    });
  const args = [
    defs.map((d) => d.name),
    defs.map((d) => d.s),
    defs.map((d) => d.e),
    now,
  ];
  // Windows are [start, end); "infinity" ends are bounded by the snapshot instant.
  const money = (await db.query(q.revenueWindowsSql, args)).rows;
  const failures = (await db.query(q.failureWindowsSql, args)).rows;
  const recon = new Map(
    (await db.query(q.reconciliationWindowsSql, args)).rows.map((r) => [
      r.name,
      r,
    ]),
  );
  const windows = defs.map((d) => {
    const r = recon.get(d.name);
    return {
      name: d.name,
      label: d.label,
      start: d.s instanceof Date ? d.s.toISOString() : null,
      coverage: windowCoverage({
        preCoverageReceipts: r?.pre_coverage ?? 0,
        unmatchedReceipts: r?.unmatched ?? 0,
        gaps: r?.gaps ?? 0,
      }),
      currencies: money
        .filter((m) => m.name === d.name)
        .map((m) => {
          const gross = toMinor(m.gross);
          const refunded = toMinor(m.refunded);
          const lost = toMinor(m.disputes_lost);
          return {
            currency: m.currency,
            payments: m.payments,
            grossMinor: gross,
            netMinor: gross - refunded - lost,
            refundedMinor: refunded,
            disputesLostMinor: lost,
            newMinor: toMinor(m.new_gross),
            renewalMinor: toMinor(m.renewal_gross),
            otherMinor: toMinor(m.other_gross),
            unclassifiedMinor: toMinor(m.unclassified_gross),
            monthlyMinor: toMinor(m.monthly_gross),
            annualMinor: toMinor(m.annual_gross),
          };
        })
        .sort((a, b) => a.currency.localeCompare(b.currency)),
      failures: failures
        .filter((f) => f.name === d.name)
        .map((f) => {
          const failed = toMinor(f.failed_value);
          const recovered = toMinor(f.recovered_value);
          return {
            currency: f.currency,
            invoices: f.invoices,
            failedMinor: failed,
            recoveredMinor: recovered,
            outstandingMinor: failed - recovered,
          };
        })
        .sort((a, b) => a.currency.localeCompare(b.currency)),
    };
  });
  const mrrRows = (await db.query(mrrSql, [now])).rows;
  const totals = mrrRows.find((r) => r.currency === null);
  return {
    period: info(w),
    ledgerStart: iso(starts.get("payment_ledger") ?? null),
    billingReasonStart: iso(starts.get("billing_reason") ?? null),
    failuresStart: iso(starts.get("payment_failures") ?? null),
    windows,
    mrr: {
      status: mrrStatus(totals?.subscriptions ?? 0, totals?.priced ?? 0),
      paying: totals?.subscriptions ?? 0,
      priced: totals?.priced ?? 0,
      currencies: mrrRows
        .filter((r) => r.currency !== null)
        .map((r) => ({
          currency: r.currency,
          mrrMinor: toMinor(r.mrr),
          cancelingMinor: toMinor(r.canceling),
        })),
    },
  };
}

/* ---------------- Cohorts ---------------- */
export interface CohortIntel {
  registration: {
    month: string;
    registered: number;
    trials: number;
    converted: number;
    everPaid: number;
    payingNow: number;
    cancelled: number;
    reactivated: number;
  }[];
  trial: {
    month: string;
    started: number;
    matured: number;
    converted: number;
    maturedConverted: number;
  }[];
  historyStart: string | null;
}
export async function loadCohorts(
  db: PoolClient,
  now: Date,
  starts: Map<string, Date>,
): Promise<CohortIntel> {
  const registration = (
    await db.query(q.registrationCohortsSql, [now])
  ).rows.map((r) => ({
    month: r.month,
    registered: r.registered,
    trials: r.trials,
    converted: r.converted,
    everPaid: r.ever_paid,
    payingNow: r.paying_now,
    cancelled: r.cancelled,
    reactivated: r.reactivated,
  }));
  const trial = (await db.query(q.trialCohortsSql, [now])).rows.map((r) => ({
    month: r.month,
    started: r.started,
    matured: r.matured,
    converted: r.converted,
    maturedConverted: r.matured_converted,
  }));
  return {
    registration,
    trial,
    historyStart: iso(starts.get("subscription_history") ?? null),
  };
}

/* ---------------- Campaigns & funnel ---------------- */
export interface CampaignRow {
  key: string;
  label: string;
  kind: "campaign" | "none" | "grouped";
  count: number;
  registrations: number;
  trials: number;
  converted: number;
  paid: number;
  payingNow: number;
  revenue: { currency: string; netMinor: number }[];
}
export interface CampaignIntel {
  period: PeriodInfo;
  rows: CampaignRow[];
  suppressed: number;
  totals: Omit<CampaignRow, "key" | "label" | "kind" | "count" | "revenue">;
  selected: CampaignRow | null;
}
const sumRows = (rows: CampaignRow[]) =>
  rows.reduce(
    (t, r) => ({
      registrations: t.registrations + r.registrations,
      trials: t.trials + r.trials,
      converted: t.converted + r.converted,
      paid: t.paid + r.paid,
      payingNow: t.payingNow + r.payingNow,
    }),
    { registrations: 0, trials: 0, converted: 0, paid: 0, payingNow: 0 },
  );
const mergeRevenue = (rows: CampaignRow[]) => {
  const byCurrency = new Map<string, number>();
  for (const r of rows)
    for (const m of r.revenue)
      byCurrency.set(
        m.currency,
        (byCurrency.get(m.currency) ?? 0) + m.netMinor,
      );
  return [...byCurrency]
    .map(([currency, netMinor]) => ({ currency, netMinor }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
};

export async function loadCampaigns(
  db: PoolClient,
  now: Date,
  period: PeriodId,
  selected?: string | null,
): Promise<CampaignIntel> {
  const w = periodWindow(period, now);
  const args = [w.start ?? OPEN, now, now];
  const base = (await db.query(q.campaignSql, args)).rows;
  const revenue = (await db.query(q.campaignRevenueSql, args)).rows;
  // Malformed keys are never displayed; they fold into "no campaign".
  const byKey = new Map<string, CampaignRow>();
  for (const r of base) {
    const key = campaignKey(r.campaign);
    const id = key ?? "__none__";
    const row = byKey.get(id) ?? {
      key: id,
      label: key ?? "No campaign recorded",
      kind: key ? ("campaign" as const) : ("none" as const),
      count: 0,
      registrations: 0,
      trials: 0,
      converted: 0,
      paid: 0,
      payingNow: 0,
      revenue: [],
    };
    row.registrations += r.registrations;
    row.count = row.registrations;
    row.trials += r.trials;
    row.converted += r.converted;
    row.paid += r.paid;
    row.payingNow += r.paying_now;
    byKey.set(id, row);
  }
  for (const r of revenue) {
    const id = campaignKey(r.campaign) ?? "__none__";
    const row = byKey.get(id);
    if (!row) continue;
    const net = toMinor(r.net);
    const existing = row.revenue.find((m) => m.currency === r.currency);
    if (existing) existing.netMinor += net;
    else row.revenue.push({ currency: r.currency, netMinor: net });
  }
  const campaigns = [...byKey.values()].filter((r) => r.kind === "campaign");
  const none = byKey.get("__none__");
  const { rows, suppressed } = suppress(campaigns, (small) => ({
    key: "__grouped__",
    label: `Smaller campaigns (fewer than ${MIN_GROUP} registrations each)`,
    kind: "grouped" as const,
    count: small.reduce((n, r) => n + r.count, 0),
    ...sumRows(small),
    revenue: mergeRevenue(small),
  }));
  rows.sort((a, b) =>
    a.kind === "grouped"
      ? 1
      : b.kind === "grouped"
        ? -1
        : b.registrations - a.registrations || a.key.localeCompare(b.key),
  );
  const all = none ? [...rows, none] : rows;
  const key = campaignKey(selected);
  return {
    period: info(w),
    rows: all,
    suppressed,
    totals: sumRows(all),
    selected:
      (key && rows.find((r) => r.kind === "campaign" && r.key === key)) || null,
  };
}

/* ---------------- Audience ---------------- */
export interface AudienceIntel {
  period: PeriodInfo;
  rows: {
    code: string;
    name: string;
    registrations: number;
    payingNow: number;
  }[];
  grouped: {
    registrations: number;
    payingNow: number;
    countries: number;
  } | null;
  notProvided: number;
  unrecognised: number;
  total: number;
}
export async function loadAudience(
  db: PoolClient,
  now: Date,
  period: PeriodId,
): Promise<AudienceIntel> {
  const w = periodWindow(period, now);
  const raw = (await db.query(q.countrySql, [w.start ?? OPEN, now, now])).rows;
  let notProvided = 0;
  let unrecognised = 0;
  const known: {
    code: string;
    name: string;
    registrations: number;
    payingNow: number;
    key: string;
    count: number;
  }[] = [];
  for (const r of raw) {
    if (!r.code) notProvided += r.registrations;
    else {
      const name = countryName(r.code);
      if (!name) unrecognised += r.registrations;
      else
        known.push({
          code: r.code,
          name,
          registrations: r.registrations,
          payingNow: r.paying_now,
          key: r.code,
          count: r.registrations,
        });
    }
  }
  const kept = known.filter((k) => k.count >= MIN_GROUP);
  const small = known.filter((k) => k.count < MIN_GROUP);
  return {
    period: info(w),
    rows: kept
      .sort(
        (a, b) =>
          b.registrations - a.registrations || a.code.localeCompare(b.code),
      )
      .map(({ code, name, registrations, payingNow }) => ({
        code,
        name,
        registrations,
        payingNow,
      })),
    grouped: small.length
      ? {
          registrations: small.reduce((n, k) => n + k.registrations, 0),
          payingNow: small.reduce((n, k) => n + k.payingNow, 0),
          countries: small.length,
        }
      : null,
    notProvided,
    unrecognised,
    total: raw.reduce((n, r) => n + r.registrations, 0),
  };
}

/* ---------------- Listening ---------------- */
export type ListeningIntel =
  | { status: "awaiting"; storiesWithWorld: number; publishedStories: number }
  | {
      status: "available";
      since: string;
      period: PeriodInfo;
      starts: number;
      completions: number;
      sessions: number;
      listenedSeconds: number;
      sleepTimers: number;
      stories: {
        storyId: string;
        title: string;
        storyWorld: string;
        season: string;
        starts: number;
        completions: number;
        replays: number;
        listenedSeconds: number;
      }[];
      byHour: number[];
      byClass: {
        listenerClass: string;
        sessions: number;
        listenedSeconds: number;
      }[];
    };
export async function loadListening(
  db: PoolClient,
  now: Date,
  period: PeriodId,
  starts: Map<string, Date>,
): Promise<ListeningIntel> {
  const since = starts.get("listening");
  if (!since) {
    const lib = (
      await db.query(
        "SELECT count(*) FILTER (WHERE published)::int AS published, count(*) FILTER (WHERE published AND story_world IS NOT NULL)::int AS with_world FROM mtm_library",
      )
    ).rows[0];
    return {
      status: "awaiting",
      storiesWithWorld: lib?.with_world ?? 0,
      publishedStories: lib?.published ?? 0,
    };
  }
  const w = periodWindow(period, now);
  const args = [w.start ?? OPEN, now];
  const s = (await db.query(q.listeningSummarySql, args)).rows[0];
  const stories = (await db.query(q.listeningStoriesSql, args)).rows;
  const hours = (await db.query(q.listeningByHourSql, args)).rows;
  const classes = (await db.query(q.listeningByClassSql, args)).rows;
  return {
    status: "available",
    since: since.toISOString(),
    period: info(w),
    starts: s.starts,
    completions: s.completions,
    sessions: s.sessions,
    listenedSeconds: toMinor(s.listened_seconds),
    sleepTimers: s.sleep_timers,
    stories: stories.map((r) => ({
      storyId: r.story_id,
      title: r.title,
      storyWorld: r.story_world,
      season: r.season,
      starts: r.starts,
      completions: r.completions,
      replays: r.replays,
      listenedSeconds: toMinor(r.listened_seconds),
    })),
    byHour: Array.from({ length: 24 }, (_, h) =>
      toMinor(hours.find((r) => r.hour === h)?.listened_seconds ?? 0),
    ),
    byClass: classes.map((r) => ({
      listenerClass: r.listener_class,
      sessions: r.sessions,
      listenedSeconds: toMinor(r.listened_seconds),
    })),
  };
}

/* ---------------- Data coverage ---------------- */
export interface CoverageIntel {
  domains: CoverageDomain[];
  sandbox: boolean;
}
export async function loadCoverage(
  db: PoolClient,
  now: Date,
  starts: Map<string, Date>,
): Promise<CoverageIntel> {
  const inv = (await db.query<Inventory>(q.inventorySql, [now])).rows[0];
  return {
    domains: evaluateCoverage(inv, starts),
    sandbox: inv.ledger_entries > 0 && inv.live_entries === 0,
  };
}
