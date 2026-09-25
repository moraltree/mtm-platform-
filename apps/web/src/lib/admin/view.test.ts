import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/app/subscribe/actions", () => ({ logout: async () => undefined }));
import { Dashboard } from "@/app/admin/Dashboard";
import type { Overview } from "./overview";
import type { Finance } from "./financeSnapshot";
const empty: Overview = {
  asOf: "2026-09-11T12:00:00Z",
  counts: {
    accounts: 0,
    paid: 0,
    trials: 0,
    canceled_accounts: 0,
    trials_started: 0,
    converted: 0,
    monthly: 0,
    annual: 0,
  },
  conversionRate: null,
  statuses: [],
  payments: { today: 0, week: 0, month: 0, lifetime: 0 },
  activity: [],
  health: {
    database: true,
    testBillingConfigured: false,
    lastWebhook: null,
    receipts: 0,
    failedPayments: 0,
    deduplication: true,
  },
  finance: null,
};
afterEach(() => vi.unstubAllGlobals());
describe("executive overview presentation", () => {
  it("renders empty data and unavailable money honestly", () => {
    vi.stubGlobal("React", React);
    const html = renderToStaticMarkup(
      React.createElement(Dashboard, { overview: empty, role: "founder" }),
    );
    expect(html).toContain(
      "No account or billing activity has been recorded yet",
    );
    expect(html).toContain("Not yet available: no recorded trial starts");
    expect(html).toContain("Not yet available");
    expect(html).not.toContain("£0");
    expect(html).toContain("None recorded");
    expect(html).toContain("Founder access");
  });
  it("renders only allowlisted fields rather than raw data or secret properties", () => {
    vi.stubGlobal("React", React);
    const overview = {
      ...empty,
      unexpected: "SECRET_SENTINEL",
      activity: [
        {
          kind: "payment" as const,
          at: empty.asOf,
          raw: "PRIVATE_PROVIDER_PAYLOAD",
        },
      ],
    };
    const html = renderToStaticMarkup(
      React.createElement(Dashboard, { overview, role: "admin" }),
    );
    expect(html).toContain("Successful subscription payment");
    expect(html).toContain("Admin access");
    expect(html).not.toContain("SECRET_SENTINEL");
    expect(html).not.toContain("PRIVATE_PROVIDER_PAYLOAD");
  });
});

const periods = ["today", "week", "month", "lifetime"] as const;
const finance = (extra: Partial<Finance> = {}): Finance => ({
  coverage: {
    ledgerStart: "2026-09-05T00:00:00Z",
    contractsStart: "2026-09-05T00:00:00Z",
    historyStart: "2026-09-05T00:00:00Z",
    backfilled: false,
  },
  mode: { testEntries: 3, liveEntries: 0 },
  revenue: periods.map((period) => ({
    period,
    coverage:
      period === "today"
        ? { status: "complete" as const, reasons: [] }
        : {
            status: "partial" as const,
            reasons: [
              "2 successful-payment receipt(s) predate ledger coverage; their amounts were never recorded.",
            ],
          },
    currencies: [
      {
        currency: "gbp",
        payments: 2,
        grossMinor: 1998,
        refundedMinor: 500,
        disputesLostMinor: 0,
        netMinor: 1498,
        pendingRefunds: 0,
        openDisputes: 0,
      },
      {
        currency: "usd",
        payments: 1,
        grossMinor: 1299,
        refundedMinor: 0,
        disputesLostMinor: 0,
        netMinor: 1299,
        pendingRefunds: 0,
        openDisputes: 0,
      },
    ],
  })),
  plans: [],
  mrr: { status: "unavailable", paying: 2, priced: 0, currencies: [] },
  lifecycle: periods.map((period) => ({
    period,
    newPaidSubscriptions: 1,
    newPaidAccounts: 1,
    returningPaid: 0,
    cancellations: 0,
    conversions: 0,
    scheduledCancellations: { count: 0, complete: period === "today" },
  })),
  maturedTrials: { matured: 0, converted: 0, rate: null },
  churn: {
    status: "unavailable",
    firstMeasurableMonth: "2026-10-01T00:00:00Z",
    availableFrom: "2026-11-01T00:00:00Z",
  },
  ...extra,
});
describe("Phase 2 finance presentation", () => {
  const render = (f: Finance) => {
    vi.stubGlobal("React", React);
    return renderToStaticMarkup(
      React.createElement(Dashboard, {
        overview: { ...empty, finance: f },
        role: "founder",
      }),
    );
  };
  it("shows per-currency amounts with coverage labels and no consolidated total", () => {
    const html = render(finance());
    expect(html).toContain("£14.98");
    expect(html).toContain("US$12.99");
    expect(html).toContain("Complete coverage");
    expect(html).toContain("Partial coverage");
    expect(html).toContain("predate ledger coverage");
    expect(html).toContain("No consolidated total");
    expect(html).toContain("Stripe TEST-mode sandbox data");
    expect(html).not.toContain("£27"); // Never GBP + USD added together.
    expect(html).toContain("Phase 2");
  });
  it("keeps MRR, churn and matured conversion explicitly unavailable", () => {
    const html = render(finance());
    expect(html).toContain("has a recorded contract amount yet");
    expect(html).toContain("Paid subscriber churn");
    expect(html).toContain("Not reconstructed from current state");
    expect(html).toContain("no trial deadline has passed");
    expect(html).toContain("earlier windows are incomplete");
  });
  it("renders partial MRR and an available churn rate with their denominators", () => {
    const html = render(
      finance({
        mrr: {
          status: "partial",
          paying: 3,
          priced: 2,
          currencies: [
            {
              currency: "gbp",
              mrrMinor: 1832,
              cancelingMinor: 999,
              subscriptions: 2,
            },
          ],
        },
        churn: {
          status: "available",
          monthStart: "2026-08-01T00:00:00Z",
          opening: 4,
          churned: 2,
          closing: 3,
          rate: 50,
        },
        revenue: periods.map((period) => ({
          period,
          coverage: { status: "complete" as const, reasons: [] },
          currencies: [],
        })),
      }),
    );
    expect(html).toContain("£18.32");
    expect(html).toContain("Partial: 2 of 3 paying subscriptions");
    expect(html).toContain("£9.99 scheduled to cancel");
    expect(html).toContain("50%");
    expect(html).toContain("August 2026: 2 of 4");
    expect(html).toContain("No recorded payments");
    expect(html).not.toContain("£0");
  });
});
