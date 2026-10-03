import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/admin/actions", () => ({
  signOutFounder: async () => undefined,
  completeFounderSignIn: async () => undefined,
}));

import { Dashboard } from "@/app/admin/Dashboard";
import { reviewFixtureOverview } from "./fixture";
import type { FounderOverview } from "./types";

const now = new Date("2026-10-03T12:00:00Z");
const notConfigured: FounderOverview = {
  asOf: now.toISOString(),
  source: "not-configured",
  counts: null,
  statuses: null,
  activity: null,
  health: { stripeTestConfigured: false, lastStripeUpdate: null },
};
const render = (
  overview: FounderOverview,
  role: "founder" | "admin" = "founder",
) => renderToStaticMarkup(React.createElement(Dashboard, { overview, role }));

describe("Founder Console dashboard", () => {
  it("keeps the approved structure", () => {
    const html = render(notConfigured);
    for (const text of [
      "FOUNDER CONSOLE",
      "Founder access",
      "Executive overview",
      "Revenue &amp; plans",
      "Trial conversion",
      "Subscription status",
      "A world of listeners",
      "Recent activity",
      "System health",
      "Metric definitions &amp; data boundaries",
      "Private Founder/Admin Analytics · Phase 1",
    ])
      expect(html).toContain(text);
    expect(render(notConfigured, "admin")).toContain("Admin access");
  });

  it("shows no figures at all when nothing is connected", () => {
    const html = render(notConfigured);
    expect(html).toContain("No subscription data connected");
    expect(html).toContain("Not configured");
    expect(html).not.toMatch(/class="[^"]*value[^"]*">\d/);
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("NaN");
  });

  it("labels review figures as development test data and keeps unavailable metrics unavailable", () => {
    const html = render(reviewFixtureOverview(now, false));
    expect(html).toContain("Development test figures — not business data");
    expect(html).toContain("Development test figures");
    expect(html).toContain("Platform trial (expired)");
    // Genuinely-unavailable metrics never get a fixture number.
    for (const label of [
      "Registered accounts",
      "Converted trials",
      "Trial-to-paid conversion",
      "Churn rate",
      "Revenue today",
      "Failed payment events",
    ])
      expect(html).toMatch(
        new RegExp(
          `<h3>${label}</h3><p class="[^"]*missing[^"]*">Not yet available`,
        ),
      );
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("NaN");
  });
});
