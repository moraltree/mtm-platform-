import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/app/subscribe/actions", () => ({ logout: async () => undefined }));
import { Dashboard } from "./Dashboard";
import { VIEWS, type ViewId } from "./views";
import { LISTENING_METRICS } from "./ListeningView";
import type { ConsoleData } from "@/lib/admin/console";
import type { Overview } from "@/lib/admin/overview";
import type {
  PeriodInfo,
  CampaignRow,
  RevenueWindowIntel,
} from "@/lib/admin/intel/load";
import { compare, fillDays, SERIES } from "@/lib/admin/insights";
import type { Insights } from "@/lib/admin/insightsSnapshot";
import { evaluateCoverage } from "@/lib/admin/intel/rules";

const now = new Date("2026-09-11T12:00:00Z");
const weekOf = (i: number) =>
  new Date(Date.UTC(2026, 5, 22 + i * 7)).toISOString().slice(0, 10);
const period: PeriodInfo = {
  id: "7d",
  label: "7 days",
  compareLabel: "previous 7 days",
  start: "2026-09-04T12:00:00.000Z",
  end: now.toISOString(),
  prevStart: "2026-08-28T12:00:00.000Z",
  prevEnd: "2026-09-04T12:00:00.000Z",
};
const insights: Insights = {
  dataStart: "2026-08-01T00:00:00Z",
  series: Object.fromEntries(
    SERIES.map((k) => [k, fillDays(new Map(), now)]),
  ) as Insights["series"],
  comparisons: Object.fromEntries(
    SERIES.map((k) => [k, { d7: compare(2, 1), d30: compare(5, 5) }]),
  ) as Insights["comparisons"],
  everPaid: 4,
  webhook: { last24h: 1, last7d: 3 },
  openGaps: 0,
  revenueSeries: [],
  feed: [],
};
const overview: Overview = {
  asOf: now.toISOString(),
  counts: {
    accounts: 40,
    paid: 7,
    trials: 5,
    canceled_accounts: 2,
    trials_started: 20,
    converted: 4,
    monthly: 5,
    annual: 2,
  },
  conversionRate: 20,
  statuses: [{ status: "active", count: 7 }],
  payments: { today: 1, week: 3, month: 9, lifetime: 20 },
  activity: [],
  health: {
    database: true,
    testBillingConfigured: true,
    lastWebhook: now.toISOString(),
    receipts: 30,
    failedPayments: 1,
    deduplication: true,
  },
  finance: {
    coverage: {
      ledgerStart: "2026-09-01T00:00:00Z",
      contractsStart: "2026-09-01T00:00:00Z",
      historyStart: "2026-09-01T00:00:00Z",
      backfilled: false,
    },
    mode: { testEntries: 5, liveEntries: 0 },
    revenue: (["today", "week", "month", "lifetime"] as const).map((p) => ({
      period: p,
      coverage: { status: "complete" as const, reasons: [] },
      currencies: [],
    })),
    plans: [],
    mrr: { status: "available", paying: 0, priced: 0, currencies: [] },
    lifecycle: [],
    maturedTrials: { matured: 0, converted: 0, rate: null },
    churn: {
      status: "unavailable",
      firstMeasurableMonth: "2026-10-01T00:00:00Z",
      availableFrom: "2026-11-01T00:00:00Z",
    },
  },
  insights,
};
const money = (currency: string, net: number) => ({
  currency,
  payments: 1,
  grossMinor: net > 0 ? net : 0,
  netMinor: net,
  refundedMinor: 0,
  disputesLostMinor: net < 0 ? -net : 0,
  newMinor: net > 0 ? net : 0,
  renewalMinor: 0,
  otherMinor: 0,
  unclassifiedMinor: 0,
  monthlyMinor: net > 0 ? net : 0,
  annualMinor: 0,
});
const window = (
  name: string,
  label: string,
  currencies = [money("gbp", 999)],
): RevenueWindowIntel => ({
  name,
  label,
  start: null,
  coverage: { status: "complete", reasons: [] },
  currencies,
  failures: [],
});
const campaignRow = (
  key: string,
  kind: CampaignRow["kind"],
  regs: number,
): CampaignRow => ({
  key,
  label:
    kind === "campaign"
      ? key
      : kind === "grouped"
        ? "Smaller campaigns (fewer than 5 registrations each)"
        : "No campaign recorded",
  kind,
  count: regs,
  registrations: regs,
  trials: regs - 1,
  converted: 1,
  paid: 2,
  payingNow: 1,
  revenue: kind === "campaign" ? [{ currency: "gbp", netMinor: 2997 }] : [],
});
const inventory = {
  accounts: 40,
  accounts_since: new Date("2026-08-01T00:00:00Z"),
  with_campaign: 30,
  with_country: 10,
  billing_events: 80,
  billing_since: new Date("2026-08-02T00:00:00Z"),
  receipts: 90,
  ledger_entries: 5,
  live_entries: 0,
  unclassified_payments: 0,
  failures: 1,
  history_rows: 9,
  subscriptions: 8,
  active_without_contract: 0,
  listening_events: 0,
  published_stories: 30,
  stories_with_world: 12,
};
const starts = new Map([
  ["payment_ledger", new Date("2026-09-01T00:00:00Z")],
  ["subscription_contracts", new Date("2026-09-01T00:00:00Z")],
  ["subscription_history", new Date("2026-09-01T00:00:00Z")],
  ["billing_reason", new Date("2026-09-01T00:00:00Z")],
  ["payment_failures", new Date("2026-09-01T00:00:00Z")],
]);
const data: ConsoleData = {
  overview,
  intelInstalled: true,
  subscribers: {
    period,
    metrics: {
      registrations: { current: 6, comparison: compare(6, 4) },
      trial_starts: { current: 3, comparison: compare(3, 3) },
      conversions: { current: 1, comparison: compare(1, 0) },
      new_paid: { current: 2, comparison: compare(2, 1) },
      new_paid_accounts: { current: 1, comparison: compare(1, 1) },
      reactivations: { current: 1, comparison: compare(1, 0) },
      cancellations: { current: 3, comparison: compare(3, 1) },
      payments: { current: 5, comparison: compare(5, 5) },
      failed_payments: { current: 2, comparison: compare(2, 0) },
    },
    netSubscriptions: { current: -1, previous: 0 },
    scheduled: { accountsNow: 2, inPeriod: 1 },
    history: {
      status: "available",
      opening: 6,
      closing: 7,
      gained: 2,
      lost: 1,
    },
    weekly: {
      registrations: Array.from({ length: 12 }, (_, i) => ({
        week: weekOf(i),
        value: i,
        partial: i === 11,
      })),
      trial_starts: Array.from({ length: 12 }, (_, i) => ({
        week: weekOf(i),
        value: 1,
        partial: i === 11,
      })),
      new_paid: Array.from({ length: 12 }, (_, i) => ({
        week: weekOf(i),
        value: 0,
        partial: i === 11,
      })),
      cancellations: Array.from({ length: 12 }, (_, i) => ({
        week: weekOf(i),
        value: 0,
        partial: i === 11,
      })),
    },
  },
  revenue: {
    period,
    ledgerStart: "2026-09-01T00:00:00Z",
    billingReasonStart: "2026-09-05T00:00:00Z",
    failuresStart: "2026-09-05T00:00:00Z",
    windows: [
      window("today", "Revenue today"),
      window("week", "This week"),
      window("month", "This month", [money("gbp", 999), money("usd", -1299)]),
      window("year", "Year to date"),
      window("lifetime", "Lifetime recorded"),
      {
        ...window("current", "7 days", [
          money("gbp", 1998),
          money("usd", 1299),
        ]),
        failures: [
          {
            currency: "usd",
            invoices: 1,
            failedMinor: 1299,
            recoveredMinor: 0,
            outstandingMinor: 1299,
          },
        ],
      },
      window("previous", "previous 7 days", [money("gbp", 999)]),
    ],
    mrr: {
      status: "partial",
      paying: 3,
      priced: 2,
      currencies: [{ currency: "gbp", mrrMinor: 1832, cancelingMinor: 0 }],
    },
  },
  cohorts: {
    registration: [
      {
        month: "2026-09",
        registered: 10,
        trials: 8,
        converted: 2,
        everPaid: 4,
        payingNow: 3,
        cancelled: 1,
        reactivated: 1,
      },
    ],
    trial: [
      {
        month: "2026-09",
        started: 8,
        matured: 0,
        converted: 2,
        maturedConverted: 0,
      },
    ],
    historyStart: "2026-09-01T00:00:00Z",
  },
  campaigns: {
    period,
    rows: [
      campaignRow("free30", "campaign", 6),
      campaignRow("__grouped__", "grouped", 3),
      campaignRow("__none__", "none", 2),
    ],
    suppressed: 2,
    totals: {
      registrations: 11,
      trials: 8,
      converted: 3,
      paid: 6,
      payingNow: 3,
    },
    selected: campaignRow("free30", "campaign", 6),
  },
  audience: {
    period,
    rows: [
      { code: "GB", name: "United Kingdom", registrations: 6, payingNow: 2 },
    ],
    grouped: { registrations: 2, payingNow: 0, countries: 2 },
    notProvided: 3,
    unrecognised: 1,
    total: 12,
  },
  listening: { status: "awaiting", storiesWithWorld: 12, publishedStories: 30 },
  coverage: { domains: evaluateCoverage(inventory, starts), sandbox: true },
};
const render = (view: ViewId, d: ConsoleData = data, p = "7d" as const) =>
  renderToStaticMarkup(
    React.createElement(Dashboard, {
      data: d,
      role: "founder",
      view,
      period: p,
      asOf: now.toISOString(),
    }),
  );

beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());

describe("Phase 4 console views", () => {
  it("groups navigation and marks exactly one view and one period current", () => {
    const html = render("growth");
    for (const g of ["Business", "Growth", "Product", "System"])
      expect(html).toContain(`>${g}<`);
    expect(html.match(/aria-current="page"/g)).toHaveLength(2); // nav item + period tab
    expect(html).toContain('href="/admin?view=growth&amp;period=today"');
    expect(html).toContain("Phase 4 · Read-only");
  });

  it("shows subscriber movement with fair comparisons, growth and exports", () => {
    // Phase 5: export links appear only when ADMIN_EXPORTS_ENABLED is set.
    expect(render("growth")).not.toContain("/api/admin/export");
    vi.stubEnv("SUBSCRIPTIONS_ENABLED", "true");
    vi.stubEnv("ADMIN_ANALYTICS_ENABLED", "true");
    vi.stubEnv("ADMIN_EXPORTS_ENABLED", "true");
    const html = render("growth");
    vi.unstubAllEnvs();
    for (const t of [
      "Reactivated subscribers",
      "Completed cancellations",
      "Scheduled cancellations",
      "Net subscription movement",
      "Up 50%", // Registrations 6 vs 4.
      "vs previous 7 days (4)",
      "Up from 0", // Reactivations: no invented percentage.
      "Paid accounts at start",
      "This week (so far)",
      'href="/api/admin/export?report=subscribers&amp;period=7d"',
    ])
      expect(html).toContain(t);
    const unmeasured = render("growth", {
      ...data,
      subscribers: {
        ...data.subscribers!,
        history: {
          status: "unavailable",
          historyStart: "2026-09-01T00:00:00Z",
        },
        scheduled: { accountsNow: 2, inPeriod: null },
      },
    });
    expect(unmeasured).toContain("Not measurable for this period");
    expect(unmeasured).toContain(
      "not measurable before subscription history began",
    );
  });

  it("keeps revenue per currency, with coverage dates, breakdown and failed value", () => {
    const html = render("finance");
    for (const t of [
      "Year to date",
      "£9.99",
      "-US$12.99", // A net loss is shown, not hidden.
      "New subscription revenue",
      "Renewal revenue",
      "Failed-payment value",
      "US$12.99",
      "Partial: 2 of 3 subscriptions",
      "no consolidated total without an authoritative exchange rate",
      "All recorded amounts are Stripe TEST-mode sandbox data.",
    ])
      expect(html).toContain(t);
    expect(html).not.toContain("£32"); // £19.98 + US$12.99 never summed.
  });

  it("shows unmeasured funnel stages as unavailable, never zero", () => {
    const html = render("funnel");
    expect(html.match(/>Unavailable</g)).toHaveLength(3); // Visit, first listen, repeat listen.
    expect(html).toContain("Awaiting approved listening telemetry.");
    expect(html).toContain("Retained subscriber");
    expect(html).toContain("27.3% of registrations"); // 3 of 11 paying now.
  });

  it("reports validated campaigns with suppression, drill-down and attribution rules", () => {
    const html = render("campaigns");
    expect(html).toContain("Attribution rule");
    expect(html).toContain(
      "Smaller campaigns (fewer than 5 registrations each)",
    );
    expect(html).toContain(
      'href="/admin?view=campaigns&amp;period=7d&amp;campaign=free30"',
    );
    expect(html).toContain("Campaign · free30");
    expect(html).toContain("£29.97");
  });

  it("labels geography as self-declared and never infers it", () => {
    const html = render("audience");
    expect(html).toContain("Provenance: self-declared registration country");
    expect(html).toContain(
      "never inferred from email, currency, campaign or IP address",
    );
    expect(html).toContain("2 smaller countries");
    expect(html).toContain("Not provided: 3");
  });

  it("shows every listening metric as awaiting telemetry with no figures", () => {
    const html = render("listening");
    expect(html.match(/Awaiting telemetry/g)).toHaveLength(
      LISTENING_METRICS.length,
    );
    expect(html).toContain("Never stored: IP address");
    expect(html).not.toMatch(/\d+(\.\d+)? h\b|\d+ min\b/);
  });

  it("renders listening analytics once telemetry is live", () => {
    const html = render("listening", {
      ...data,
      listening: {
        status: "available",
        since: "2026-09-10T00:00:00Z",
        period,
        starts: 4,
        completions: 2,
        sessions: 2,
        listenedSeconds: 7200,
        sleepTimers: 1,
        stories: [
          {
            storyId: "s1",
            title: "Story One",
            storyWorld: "Savannah Seven",
            season: "1",
            starts: 4,
            completions: 2,
            replays: 1,
            listenedSeconds: 7200,
          },
        ],
        byHour: Array.from({ length: 24 }, (_, h) => (h === 19 ? 7200 : 0)),
        byClass: [
          { listenerClass: "trial", sessions: 2, listenedSeconds: 7200 },
        ],
      },
    });
    for (const t of [
      "2.0 h",
      "1.0 h",
      "50%",
      "Story One",
      "Savannah Seven",
      "19:00",
    ])
      expect(html).toContain(t);
  });

  it("explains data coverage and the trust summary on the overview", () => {
    expect(render("coverage")).not.toContain("Download aggregate CSV");
    vi.stubEnv("SUBSCRIPTIONS_ENABLED", "true");
    vi.stubEnv("ADMIN_ANALYTICS_ENABLED", "true");
    vi.stubEnv("ADMIN_EXPORTS_ENABLED", "true");
    const html = render("coverage");
    vi.unstubAllEnvs();
    for (const t of [
      "Available",
      "Partial",
      "Unavailable",
      "Test/sandbox money data",
      "Webhook delivery failures",
      'href="/api/admin/export?report=coverage"',
    ])
      expect(html).toContain(t);
    const o = render("overview");
    expect(o).toContain("What data can I trust?");
    expect(o).toContain("money figures are TEST-mode sandbox data");
  });

  it("explains a missing Phase 4 migration instead of showing zeros", () => {
    const bare: ConsoleData = { overview, intelInstalled: false };
    for (const v of [
      "cohorts",
      "funnel",
      "campaigns",
      "audience",
      "listening",
    ] as const)
      expect(render(v, bare)).toContain("003_analytics_intelligence.sql");
  });

  it("never renders private or unexpected properties in any view", () => {
    const leaky = {
      ...data,
      email: "SENTINEL@example.invalid",
      campaigns: {
        ...data.campaigns!,
        rows: data.campaigns!.rows.map((r) => ({
          ...r,
          accountIds: ["SENTINEL-ID"],
        })),
      },
    } as unknown as ConsoleData;
    for (const v of VIEWS.map((x) => x.id)) {
      const html = render(v, leaky);
      expect(html).not.toContain("SENTINEL");
      expect(html.match(/<form/g)).toHaveLength(1); // Sign out only: read-only console.
    }
  });
});
