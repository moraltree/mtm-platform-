import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/app/subscribe/actions", () => ({ logout: async () => undefined }));
import { Dashboard } from "./Dashboard";
import { VIEWS, type ViewId } from "./views";
import { FUTURE_AREAS } from "./RoadmapView";
import { BarTrend } from "./charts";
import type { Overview } from "@/lib/admin/overview";
import type { Insights } from "@/lib/admin/insightsSnapshot";
import { compare, fillDays, SERIES } from "@/lib/admin/insights";

const now = new Date("2026-09-11T12:00:00Z");
const series = (values: number[]) =>
  fillDays(
    new Map(
      values.map((v, i) => [
        new Date(now.getTime() - (values.length - 1 - i) * 86_400_000)
          .toISOString()
          .slice(0, 10),
        v,
      ]),
    ),
    now,
  );
const insights: Insights = {
  dataStart: "2026-08-01T09:00:00Z",
  series: Object.fromEntries(
    SERIES.map((k, i) => [k, series([1, 0, 2, i, 3])]),
  ) as Insights["series"],
  comparisons: {
    registrations: { d7: compare(6, 4), d30: compare(20, 10) },
    trial_starts: { d7: compare(3, 3), d30: compare(9, 0) },
    conversions: { d7: compare(1, 2), d30: compare(4, 4) },
    new_paid: { d7: compare(2, 1), d30: compare(5, 2) },
    cancellations: { d7: compare(3, 1), d30: compare(4, 2) },
    payments: { d7: compare(7, 7), d30: compare(30, 20) },
    failed_payments: { d7: compare(2, 0), d30: compare(2, 1) },
  },
  everPaid: 9,
  webhook: { last24h: 4, last7d: 12 },
  openGaps: 1,
  revenueSeries: [
    {
      currency: "gbp",
      days: fillDays(new Map(), now).map((p, i) => ({
        day: p.day,
        grossMinor: i === 28 ? 1998 : 0,
        payments: i === 28 ? 2 : 0,
        coverage: i < 20 ? "none" : i === 20 ? "partial" : "full",
        partial: p.partial,
      })),
    },
  ],
  feed: [
    { kind: "payment_failed", at: "2026-09-11T11:00:00Z" },
    { kind: "new_paid", at: "2026-09-11T10:00:00Z" },
    { kind: "registration", at: "2026-09-10T10:00:00Z" },
  ],
};
const overview: Overview = {
  asOf: now.toISOString(),
  counts: {
    accounts: 40,
    paid: 7,
    trials: 12,
    canceled_accounts: 3,
    trials_started: 30,
    converted: 6,
    monthly: 5,
    annual: 2,
  },
  conversionRate: 20,
  statuses: [
    { status: "active", count: 6 },
    { status: "canceling", count: 1 },
    { status: "canceled", count: 3 },
  ],
  payments: { today: 1, week: 7, month: 30, lifetime: 80 },
  activity: [],
  health: {
    database: true,
    testBillingConfigured: true,
    lastWebhook: "2026-09-11T11:00:00Z",
    receipts: 200,
    failedPayments: 5,
    deduplication: true,
  },
  finance: null,
  insights,
};
const render = (view: ViewId, data: Overview = overview) =>
  renderToStaticMarkup(
    React.createElement(Dashboard, { overview: data, role: "founder", view }),
  );

beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());

describe("Phase 3 Founder Console", () => {
  it.each(VIEWS.map((v) => v.id))(
    "renders the %s view with exactly one current nav item and read-only chrome",
    (view) => {
      const html = render(view);
      expect(html.match(/aria-current="page"/g)).toHaveLength(1);
      const current = VIEWS.find((v) => v.id === view)!;
      expect(html).toMatch(
        new RegExp(
          `aria-current="page"[^>]*>${current.label.replace("&", "&amp;")}<`,
        ),
      );
      expect(html).toContain("Phase 4 · Read-only");
      expect(html).toContain("Founder access");
      // No write capability exists anywhere in the console.
      expect(html.match(/<form/g)).toHaveLength(1); // Sign out only.
      expect(html).not.toMatch(/refund now|delete|cancel subscription/i);
      expect(html).not.toContain("<main");
    },
  );

  it("leads the overview with KPIs, fair deltas and tap-friendly definitions", () => {
    const html = render("overview");
    expect(html).toContain("Active paid subscribers");
    expect(html).toContain("New paid subscriptions, last 30 days:");
    expect(html).toContain("Up 150%"); // 5 vs 2 new paid subscriptions.
    expect(html).toContain("vs previous 30 days (2)");
    expect(html).toContain('aria-label="About Active paid subscribers"');
    expect(html).toContain("Monthly paid accounts");
    expect(html).toContain("Payment ledger not installed");
    expect(html).toContain("Revenue amounts are not yet available");
    expect(html).toContain("Payment attempt failed");
    expect(html).toContain("Attention"); // Failed payments carry words, not colour alone.
  });

  it("keeps the Phase 3 trends, conversion and status sections on Subscribers", () => {
    // Phase 4 moved the funnel to its own view and replaced the rolling
    // comparison table with period KPIs; without the Phase 4 migration the
    // view says so rather than showing zeros.
    const html = render("growth");
    for (const text of [
      "Period subscriber intelligence",
      "Not installed",
      "Daily trends",
      "records since",
      "Trial-to-paid conversion",
      "Canceling at period end",
    ])
      expect(html).toContain(text);
  });

  it("marks uncovered revenue days as not covered rather than zero", () => {
    const html = render("finance", {
      ...overview,
      finance: {
        coverage: {
          ledgerStart: "2026-08-23T10:00:00Z",
          contractsStart: "2026-08-23T10:00:00Z",
          historyStart: "2026-08-23T10:00:00Z",
          backfilled: false,
        },
        mode: { testEntries: 2, liveEntries: 0 },
        revenue: (["today", "week", "month", "lifetime"] as const).map(
          (period) => ({
            period,
            coverage: { status: "complete" as const, reasons: [] },
            currencies: [],
          }),
        ),
        plans: [],
        mrr: { status: "available", paying: 0, priced: 0, currencies: [] },
        lifecycle: [],
        maturedTrials: { matured: 0, converted: 0, rate: null },
        churn: {
          status: "unavailable",
          firstMeasurableMonth: "2026-09-01T00:00:00Z",
          availableFrom: "2026-10-01T00:00:00Z",
        },
      },
    });
    expect(html).toContain("GBP gross collected");
    expect(html).toContain("£19.98");
    expect(html.match(/Not covered/g)).toHaveLength(20);
    expect(html).toContain("Shaded days precede ledger coverage");
    expect(html).toContain("Failed payment attempts · 7 days");
  });

  it("reports operations evidence without claiming delivery health", () => {
    const html = render("operations");
    expect(html).toContain("TEST configured");
    expect(html).toContain("4 in the last 24 hours, 12 in 7 days");
    expect(html).toContain("Failed webhook deliveries");
    expect(html).toContain("This is not a zero-failure claim");
    expect(html).toContain("not installed on this database");
  });

  it("lists every still-inactive area on Data coverage with its activation requirement", () => {
    const html = render("coverage");
    expect(FUTURE_AREAS.map((a) => a.id)).toEqual([
      "listening",
      "partners",
      "sources",
      "visits",
      "devices",
    ]);
    for (const area of FUTURE_AREAS)
      expect(html).toContain(area.title.replace("&", "&amp;"));
    // Five future cards plus the "not installed" coverage inventory notice.
    expect(html.match(/Not yet available/g)).toHaveLength(6);
    expect(html.match(/Required to activate/g)).toHaveLength(5);
    expect(html).not.toMatch(/\d+%/);
  });

  it("never renders unexpected or private properties in any view", () => {
    const leaky = {
      ...overview,
      email: "parent@example.test",
      insights: {
        ...insights,
        feed: [
          {
            kind: "payment",
            at: now.toISOString(),
            customer: "cus_PRIVATE",
          },
          { kind: "unknown_kind", at: now.toISOString() },
        ],
      },
    } as unknown as Overview;
    for (const view of VIEWS.map((v) => v.id)) {
      const html = render(view, leaky);
      expect(html).not.toContain("cus_PRIVATE");
      expect(html).not.toContain("parent@example.test");
      expect(html).not.toContain("unknown_kind");
    }
  });
});

describe("BarTrend chart", () => {
  it("summarises the series accessibly and labels today's partial bucket", () => {
    const html = renderToStaticMarkup(
      React.createElement(BarTrend, {
        title: "Registrations",
        unit: "registrations",
        points: series([2, 0, 5]),
      }),
    );
    expect(html).toContain('role="img"');
    expect(html).toContain(
      "Registrations: 7 registrations across 30 covered days, peak 5 on 11 Sept.",
    );
    expect(html).toContain("Today (so far)");
    expect(html).toContain("(today so far): 5 registrations");
    expect(html).toContain("Show data table");
    expect(html.match(/<tr>/g)).toHaveLength(31);
  });
});
