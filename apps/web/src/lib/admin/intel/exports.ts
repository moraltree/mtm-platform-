import type { ConsoleData } from "../console";
import type { CampaignRow } from "./load";
import { minorExponent } from "../finance";
import { minorToDecimal, toCsv, type Cell } from "./csv";
import { EXPORT_MIN_GROUP, belowExportMinimum, exportCount } from "./rules";

/**
 * Export classes. "aggregate" reports carry only suppressed counts and
 * amounts. "sensitive" is reserved for any future non-aggregate/personal
 * report: those require step-up authentication, which does not exist yet,
 * so the route refuses them (see stepUpSatisfied below).
 */
export type ExportSensitivity = "aggregate" | "sensitive";
export interface ExportDefinition {
  view: "growth" | "finance" | "cohorts" | "campaigns" | "coverage";
  sensitivity: ExportSensitivity;
}

/** Reports allowed for export. Every current report is aggregate-only. */
export const EXPORT_REPORTS = {
  subscribers: { view: "growth", sensitivity: "aggregate" },
  revenue: { view: "finance", sensitivity: "aggregate" },
  cohorts: { view: "cohorts", sensitivity: "aggregate" },
  campaigns: { view: "campaigns", sensitivity: "aggregate" },
  coverage: { view: "coverage", sensitivity: "aggregate" },
} as const satisfies Record<string, ExportDefinition>;
export type ExportReportId = keyof typeof EXPORT_REPORTS;

/**
 * Step-up authentication for sensitive (non-aggregate) exports is not built
 * yet, so it is never satisfied: a sensitive report stays unavailable until a
 * real step-up mechanism (fresh re-verification of the session) replaces
 * this function. Aggregate reports need no step-up.
 */
export function stepUpSatisfied(sensitivity: ExportSensitivity): boolean {
  return sensitivity === "aggregate";
}

export function parseReport(value: unknown): ExportReportId | null {
  // Own keys only: `in` would also accept prototype names such as "__proto__".
  return typeof value === "string" && Object.hasOwn(EXPORT_REPORTS, value)
    ? (value as ExportReportId)
    : null;
}

const money = (amount: number, currency: string) =>
  minorToDecimal(amount, minorExponent(currency));
const WITHHELD = `withheld (<${EXPORT_MIN_GROUP})`;

/**
 * Re-applies the external threshold to campaign rows that the console
 * suppressed only at the internal threshold. Campaigns under 10 are folded
 * into one group; if that group is still under 10, the smallest remaining
 * campaigns are folded in too (secondary suppression), so no campaign can be
 * recovered by subtracting the visible rows from a total.
 */
export function exportCampaignRows(rows: CampaignRow[]): CampaignRow[] {
  const none = rows.filter((r) => r.kind === "none");
  const kept = rows
    .filter((r) => r.kind === "campaign" && r.registrations >= EXPORT_MIN_GROUP)
    .sort((a, b) => b.registrations - a.registrations);
  const small = rows.filter(
    (r) =>
      r.kind === "grouped" ||
      (r.kind === "campaign" && r.registrations < EXPORT_MIN_GROUP),
  );
  const size = () => small.reduce((n, r) => n + r.registrations, 0);
  while (small.length && size() < EXPORT_MIN_GROUP && kept.length)
    small.push(kept.pop()!);
  if (!small.length) return [...kept, ...none];
  const revenue = new Map<string, number>();
  for (const r of small)
    for (const m of r.revenue)
      revenue.set(m.currency, (revenue.get(m.currency) ?? 0) + m.netMinor);
  const sum = (
    k: "registrations" | "trials" | "converted" | "paid" | "payingNow",
  ) => small.reduce((n, r) => n + r[k], 0);
  const grouped: CampaignRow = {
    key: "__grouped__",
    label: `Smaller campaigns (fewer than ${EXPORT_MIN_GROUP} registrations each)`,
    kind: "grouped",
    count: sum("registrations"),
    registrations: sum("registrations"),
    trials: sum("trials"),
    converted: sum("converted"),
    paid: sum("paid"),
    payingNow: sum("payingNow"),
    revenue: [...revenue].map(([currency, netMinor]) => ({
      currency,
      netMinor,
    })),
  };
  return [...kept, grouped, ...none];
}

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
    [
      "Suppression",
      `External minimum group size ${EXPORT_MIN_GROUP}: counts from 1 to ${EXPORT_MIN_GROUP - 1} are shown as <${EXPORT_MIN_GROUP}; amounts from fewer than ${EXPORT_MIN_GROUP} payments or payers are withheld`,
    ],
  ];
  if (report === "subscribers" && data.subscribers && data.overview) {
    const s = data.subscribers;
    const row = (
      metric: string,
      current: number,
      previous: number | null,
      change: number | null,
    ): Cell[] => [
      metric,
      exportCount(current),
      previous == null ? null : exportCount(previous),
      // A percentage change between small groups reveals them; withhold it.
      belowExportMinimum(current) || belowExportMinimum(previous)
        ? null
        : change,
    ];
    const rows: Cell[][] = Object.entries(s.metrics).map(([k, m]) =>
      row(
        k,
        m.current,
        m.comparison?.previous ?? null,
        m.comparison?.change ?? null,
      ),
    );
    const c = data.overview.counts;
    rows.push(row("active_paid_subscribers_now", c.paid, null, null));
    rows.push(row("monthly_paid_accounts_now", c.monthly, null, null));
    rows.push(row("annual_paid_accounts_now", c.annual, null, null));
    rows.push(
      row(
        "scheduled_cancellation_accounts_now",
        s.scheduled.accountsNow,
        null,
        null,
      ),
    );
    rows.push(
      row(
        "net_subscription_movement",
        s.netSubscriptions.current,
        s.netSubscriptions.previous,
        null,
      ),
    );
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
      for (const c of w.currencies) {
        // Amounts built from fewer than 10 payments could describe one payer.
        const hide = c.payments < EXPORT_MIN_GROUP;
        const amount = (minor: number) =>
          hide ? WITHHELD : money(minor, c.currency);
        rows.push([
          w.name,
          c.currency.toUpperCase(),
          w.coverage.status,
          exportCount(c.payments),
          amount(c.grossMinor),
          amount(c.newMinor),
          amount(c.renewalMinor),
          amount(c.unclassifiedMinor),
          amount(c.monthlyMinor),
          amount(c.annualMinor),
          amount(c.refundedMinor),
          amount(c.disputesLostMinor),
          amount(c.netMinor),
        ]);
      }
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
      data.cohorts.registration.map((c) => {
        const small = belowExportMinimum(c.registered);
        const cell = (n: number) =>
          small ? `<${EXPORT_MIN_GROUP}` : exportCount(n);
        return [
          c.month,
          cell(c.registered),
          cell(c.trials),
          cell(c.converted),
          cell(c.everPaid),
          cell(c.payingNow),
          cell(c.cancelled),
          cell(c.reactivated),
        ];
      }),
    );
  }
  if (report === "campaigns" && data.campaigns) {
    const c = data.campaigns;
    return toCsv(
      [
        ...meta(c.period.label),
        [
          "Campaign grouping",
          `Campaigns with fewer than ${EXPORT_MIN_GROUP} registrations are grouped`,
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
      exportCampaignRows(c.rows).map((r) => [
        r.label,
        exportCount(r.registrations),
        exportCount(r.trials),
        exportCount(r.converted),
        exportCount(r.paid),
        exportCount(r.payingNow),
        r.paid < EXPORT_MIN_GROUP
          ? r.revenue.length
            ? WITHHELD
            : ""
          : r.revenue
              .map(
                (m) =>
                  `${m.currency.toUpperCase()} ${money(m.netMinor, m.currency)}`,
              )
              .join("; "),
      ]),
    );
  }
  if (report === "coverage" && data.coverage) {
    // The console's free-text detail embeds raw counts; exports omit it.
    return toCsv(
      meta(),
      ["area", "status", "since", "source"],
      data.coverage.domains.map((d) => [d.title, d.status, d.since, d.source]),
    );
  }
  return null;
}
