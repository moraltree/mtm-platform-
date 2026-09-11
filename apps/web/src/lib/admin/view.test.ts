import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/app/subscribe/actions", () => ({ logout: async () => undefined }));
import { Dashboard } from "@/app/admin/Dashboard";
import type { Overview } from "./overview";
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
