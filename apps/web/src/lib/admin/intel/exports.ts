import type { ConsoleData } from "../console";
import { minorExponent } from "../finance";
import { minorToDecimal, toCsv, type Cell } from "./csv";

/** Reports allowed for export: aggregate, non-personal, already suppressed. */
export const EXPORT_REPORTS = {
  subscribers: "growth",
  revenue: "finance",
  cohorts: "cohorts",
  campaigns: "campaigns",
  coverage: "coverage",
} as const;
export type ExportReportId = keyof typeof EXPORT_REPORTS;

export function parseReport(value: unknown): ExportReportId | null {
  // Own keys only: `in` would also accept prototype names such as "__proto__".
  return typeof value === "string" && Object.hasOwn(EXPORT_REPORTS, value)
    ? (value as ExportReportId)
    : null;
}

const money = (amount: number, currency: string) =>
  minorToDecimal(amount, minorExponent(currency));

/** Returns null when the report's source data is unavailable (never an empty "zero" file). */
export function buildExport(
  report: ExportReportId,
  data: ConsoleData,
  asOf: string,
): string | null {
  const meta = (period?: string): [string, Cell][] => [
    ["Moral Tree Media Founder Console export", report],
    ["Generated (UTC)", asOf],
    ...(period ? ([["Period", period]] as [string, Cell][]) : []),
    ["Content", "Aggregate counts and amounts only; no personal data"],
  ];
  if (report === "subscribers" && data.subscribers && data.overview) {
    const s = data.subscribers;
    const rows: Cell[][] = Object.entries(s.metrics).map(([k, m]) => [
      k,
      m.current,
      m.comparison?.previous ?? null,
      m.comparison?.change ?? null,
    ]);
    rows.push([
      "active_paid_subscribers_now",
      data.overview.counts.paid,
      null,
      null,
    ]);
    rows.push([
      "monthly_paid_accounts_now",
      data.overview.counts.monthly,
      null,
      null,
    ]);
    rows.push([
      "annual_paid_accounts_now",
      data.overview.counts.annual,
      null,
      null,
    ]);
    rows.push([
      "scheduled_cancellation_accounts_now",
      s.scheduled.accountsNow,
      null,
      null,
    ]);
    rows.push([
      "net_subscription_movement",
      s.netSubscriptions.current,
      s.netSubscriptions.previous,
      null,
    ]);
    return toCsv(
      meta(`${s.period.label} (${s.period.start ?? "all"} to ${s.period.end})`),
      ["metric", "current", "previous_equivalent_period", "change_percent"],
      rows,
    );
  }
  if (report === "revenue" && data.revenue) {
    const r = data.revenue;
    const rows: Cell[][] = [];
    for (const w of r.windows)
      for (const c of w.currencies)
        rows.push([
          w.name,
          c.currency.toUpperCase(),
          w.coverage.status,
          c.payments,
          money(c.grossMinor, c.currency),
          money(c.newMinor, c.currency),
          money(c.renewalMinor, c.currency),
          money(c.unclassifiedMinor, c.currency),
          money(c.monthlyMinor, c.currency),
          money(c.annualMinor, c.currency),
          money(c.refundedMinor, c.currency),
          money(c.disputesLostMinor, c.currency),
          money(c.netMinor, c.currency),
        ]);
    return toCsv(
      [...meta(r.period.label), ["Ledger coverage start", r.ledgerStart]],
      [
        "window",
        "currency",
        "coverage",
        "payments",
        "gross",
        "new",
        "renewal",
        "unclassified",
        "monthly_plan",
        "annual_plan",
        "refunds",
        "lost_disputes",
        "net",
      ],
      rows,
    );
  }
  if (report === "cohorts" && data.cohorts) {
    return toCsv(
      meta(),
      [
        "registration_month",
        "registered",
        "started_trial",
        "converted_from_trial",
        "ever_paid",
        "paying_now",
        "cancelled",
        "reactivated",
      ],
      data.cohorts.registration.map((c) => [
        c.month,
        c.registered,
        c.trials,
        c.converted,
        c.everPaid,
        c.payingNow,
        c.cancelled,
        c.reactivated,
      ]),
    );
  }
  if (report === "campaigns" && data.campaigns) {
    const c = data.campaigns;
    return toCsv(
      [
        ...meta(c.period.label),
        [
          "Suppression",
          "Campaigns with fewer than 5 registrations are grouped",
        ],
      ],
      [
        "campaign",
        "registrations",
        "trial_starts",
        "trial_conversions",
        "paid",
        "paying_now",
        "attributed_net_revenue",
      ],
      c.rows.map((r) => [
        r.label,
        r.registrations,
        r.trials,
        r.converted,
        r.paid,
        r.payingNow,
        r.revenue
          .map(
            (m) =>
              `${m.currency.toUpperCase()} ${money(m.netMinor, m.currency)}`,
          )
          .join("; "),
      ]),
    );
  }
  if (report === "coverage" && data.coverage) {
    return toCsv(
      meta(),
      ["area", "status", "since", "source", "detail"],
      data.coverage.domains.map((d) => [
        d.title,
        d.status,
        d.since,
        d.source,
        d.detail,
      ]),
    );
  }
  return null;
}
