import "server-only";
import type { PoolClient } from "pg";
import {
  churnMonth,
  mrrStatus,
  rate,
  toMinor,
  windowCoverage,
  type Coverage,
  type Period,
} from "./finance";
import {
  churnSql,
  coverageSql,
  ledgerModeSql,
  ledgerPresentSql,
  lifecycleSql,
  maturedTrialsSql,
  mrrSql,
  planRevenueSql,
  reconciliationSql,
  revenueSql,
} from "./financeQueries";

export interface CurrencyRevenue {
  currency: string;
  payments: number;
  grossMinor: number;
  refundedMinor: number;
  disputesLostMinor: number;
  netMinor: number;
  pendingRefunds: number;
  openDisputes: number;
}
export interface RevenueWindow {
  period: Period;
  coverage: Coverage;
  /** One entry per currency. No consolidated total: no authoritative FX source. */
  currencies: CurrencyRevenue[];
}
export interface Finance {
  coverage: {
    ledgerStart: string;
    contractsStart: string;
    historyStart: string;
    backfilled: boolean;
  };
  mode: { testEntries: number; liveEntries: number };
  revenue: RevenueWindow[];
  plans: {
    currency: string;
    plan: "monthly" | "annual" | "unattributed";
    monthPayments: number;
    monthMinor: number;
    lifetimePayments: number;
    lifetimeMinor: number;
  }[];
  mrr: {
    status: "available" | "partial" | "unavailable";
    paying: number;
    priced: number;
    currencies: {
      currency: string;
      mrrMinor: number;
      cancelingMinor: number;
      subscriptions: number;
    }[];
  };
  lifecycle: {
    period: Period;
    newPaidSubscriptions: number;
    newPaidAccounts: number;
    returningPaid: number;
    cancellations: number;
    conversions: number;
    scheduledCancellations: { count: number; complete: boolean };
  }[];
  maturedTrials: { matured: number; converted: number; rate: number | null };
  churn:
    | {
        status: "available";
        monthStart: string;
        opening: number;
        churned: number;
        closing: number;
        rate: number | null;
      }
    | {
        status: "unavailable";
        firstMeasurableMonth: string;
        availableFrom: string;
      };
}

const PERIODS: Period[] = ["today", "week", "month", "lifetime"];

/** Runs inside the caller's read-only repeatable-read transaction. */
export async function readFinance(
  db: PoolClient,
  now: Date,
  w: { today: Date; week: Date; month: Date },
): Promise<Finance | null> {
  if (!(await db.query(ledgerPresentSql)).rows[0]?.present) return null;
  const params = [now, w.today, w.week, w.month];
  const starts = new Map<string, { coverage_start: Date; method: string }>(
    (await db.query(coverageSql)).rows.map((r) => [r.dataset, r]),
  );
  const ledger = starts.get("payment_ledger");
  const contracts = starts.get("subscription_contracts");
  const history = starts.get("subscription_history");
  if (!ledger || !contracts || !history) return null;

  const revenueRows = (await db.query(revenueSql, params)).rows;
  const reconciliation = new Map(
    (await db.query(reconciliationSql, params)).rows.map((r) => [r.period, r]),
  );
  const revenue = PERIODS.map((period) => {
    const r = reconciliation.get(period);
    return {
      period,
      coverage: windowCoverage({
        preCoverageReceipts: r?.pre_coverage ?? 0,
        unmatchedReceipts: r?.unmatched ?? 0,
        gaps: r?.gaps ?? 0,
      }),
      currencies: revenueRows
        .filter((row) => row.period === period)
        .map((row) => {
          const grossMinor = toMinor(row.gross);
          const refundedMinor = toMinor(row.refunded);
          const disputesLostMinor = toMinor(row.disputes_lost);
          return {
            currency: row.currency,
            payments: row.payments,
            grossMinor,
            refundedMinor,
            disputesLostMinor,
            netMinor: grossMinor - refundedMinor - disputesLostMinor,
            pendingRefunds: row.pending_refunds,
            openDisputes: row.open_disputes,
          };
        }),
    };
  });

  const plans = (await db.query(planRevenueSql, [now, w.month])).rows.map(
    (r) => ({
      currency: r.currency,
      plan: r.plan,
      monthPayments: r.month_payments,
      monthMinor: toMinor(r.month),
      lifetimePayments: r.lifetime_payments,
      lifetimeMinor: toMinor(r.lifetime),
    }),
  );

  const mrrRows = (await db.query(mrrSql, [now])).rows;
  const totals = mrrRows.find((r) => r.currency === null);
  const paying = totals?.subscriptions ?? 0;
  const priced = totals?.priced ?? 0;
  const mrr = {
    status: mrrStatus(paying, priced),
    paying,
    priced,
    currencies: mrrRows
      .filter((r) => r.currency !== null)
      .map((r) => ({
        currency: r.currency,
        mrrMinor: toMinor(r.mrr),
        cancelingMinor: toMinor(r.canceling),
        subscriptions: r.subscriptions,
      })),
  };

  const lifecycleRows = new Map(
    (await db.query(lifecycleSql, params)).rows.map((r) => [r.period, r]),
  );
  const windowStart = { today: w.today, week: w.week, month: w.month };
  const lifecycle = PERIODS.map((period) => {
    const r = lifecycleRows.get(period);
    const start =
      period === "lifetime"
        ? null
        : windowStart[period as keyof typeof windowStart];
    return {
      period,
      newPaidSubscriptions: r?.new_paid_subscriptions ?? 0,
      newPaidAccounts: r?.new_paid_accounts ?? 0,
      returningPaid: r?.returning_paid ?? 0,
      cancellations: r?.cancellations ?? 0,
      conversions: r?.conversions ?? 0,
      scheduledCancellations: {
        count: r?.scheduled_cancellations ?? 0,
        complete:
          start !== null && start.getTime() >= history.coverage_start.getTime(),
      },
    };
  });

  const trials = (await db.query(maturedTrialsSql, [now])).rows[0];
  const month = churnMonth(now, history.coverage_start);
  let churn: Finance["churn"];
  if ("start" in month) {
    const c = (await db.query(churnSql, [month.start, month.end])).rows[0];
    churn = {
      status: "available",
      monthStart: month.start.toISOString(),
      opening: c.opening,
      churned: c.churned,
      closing: c.closing,
      rate: rate(c.churned, c.opening),
    };
  } else {
    churn = {
      status: "unavailable",
      firstMeasurableMonth: month.firstMeasurable.toISOString(),
      availableFrom: month.firstAvailableAt.toISOString(),
    };
  }
  const mode = (await db.query(ledgerModeSql, [now])).rows[0];
  return {
    coverage: {
      ledgerStart: ledger.coverage_start.toISOString(),
      contractsStart: contracts.coverage_start.toISOString(),
      historyStart: history.coverage_start.toISOString(),
      backfilled: ledger.method === "backfill",
    },
    mode: { testEntries: mode.test_entries, liveEntries: mode.live_entries },
    revenue,
    plans,
    mrr,
    lifecycle,
    maturedTrials: {
      matured: trials.matured,
      converted: trials.converted,
      rate: rate(trials.converted, trials.matured),
    },
    churn,
  };
}
