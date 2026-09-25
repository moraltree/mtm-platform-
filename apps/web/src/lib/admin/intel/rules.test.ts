import { describe, expect, it } from "vitest";
import { parsePeriod, periodWindow, calendarWindows } from "./periods";
import {
  campaignKey,
  countryName,
  evaluateCoverage,
  MIN_GROUP,
  suppress,
  type Inventory,
} from "./rules";
import { csvCell, minorToDecimal, toCsv } from "./csv";
import { buildExport, parseReport } from "./exports";
import type { ConsoleData } from "../console";

const now = new Date("2026-03-31T15:30:00Z");
const DAY = 86_400_000;

describe("Phase 4 reporting periods", () => {
  it("allowlists periods and defaults to 30 days", () => {
    expect(parsePeriod("mtd")).toBe("mtd");
    expect(parsePeriod(["7d", "all"])).toBe("7d");
    for (const bad of [undefined, "", "365d", "ALL", "7d ", "<x>", 7])
      expect(parsePeriod(bad)).toBe("30d");
  });
  it("compares rolling windows with the equal window immediately before", () => {
    const w = periodWindow("7d", now);
    expect(w.start).toEqual(new Date(now.getTime() - 7 * DAY));
    expect(w.prevStart).toEqual(new Date(now.getTime() - 14 * DAY));
    expect(w.prevEnd).toEqual(w.start);
    expect(periodWindow("90d", now).prevStart).toEqual(
      new Date(now.getTime() - 180 * DAY),
    );
  });
  it("compares today with the same time yesterday", () => {
    const w = periodWindow("today", now);
    expect(w.start).toEqual(new Date("2026-03-31T00:00:00Z"));
    expect(w.prevStart).toEqual(new Date("2026-03-30T00:00:00Z"));
    expect(w.prevEnd).toEqual(new Date("2026-03-30T15:30:00Z"));
    expect(w.compareLabel).toBe("same time yesterday");
  });
  it("compares month to date with the same elapsed time, clamped to a shorter month", () => {
    const w = periodWindow("mtd", now); // 30 days 15.5 hours into March.
    expect(w.start).toEqual(new Date("2026-03-01T00:00:00Z"));
    expect(w.prevStart).toEqual(new Date("2026-02-01T00:00:00Z"));
    expect(w.prevEnd).toEqual(new Date("2026-03-01T00:00:00Z")); // February has 28 days.
    const mid = periodWindow("mtd", new Date("2026-01-10T06:00:00Z"));
    expect(mid.prevStart).toEqual(new Date("2025-12-01T00:00:00Z"));
    expect(mid.prevEnd).toEqual(new Date("2025-12-10T06:00:00Z"));
  });
  it("has no comparison for all history", () => {
    expect(periodWindow("all", now)).toMatchObject({
      start: null,
      prevStart: null,
      prevEnd: null,
      compareLabel: "",
    });
  });
  it("uses UTC calendar windows with Monday weeks and a January year start", () => {
    expect(calendarWindows(new Date("2026-03-01T10:00:00Z"))).toEqual({
      today: new Date("2026-03-01T00:00:00Z"),
      week: new Date("2026-02-23T00:00:00Z"), // 1 March 2026 is a Sunday.
      month: new Date("2026-03-01T00:00:00Z"),
      year: new Date("2026-01-01T00:00:00Z"),
    });
  });
  it("rejects invalid dates", () => {
    expect(() => periodWindow("7d", new Date("nope"))).toThrow();
  });
});

describe("attribution and suppression rules", () => {
  it("displays only well-formed campaign keys", () => {
    expect(campaignKey("free30")).toBe("free30");
    expect(campaignKey("zoo-2026_spring")).toBe("zoo-2026_spring");
    for (const bad of [
      null,
      "",
      "=HYPERLINK(1)",
      "<script>",
      "a b",
      "-leading",
      "x".repeat(65),
      42,
    ])
      expect(campaignKey(bad)).toBeNull();
  });
  it("recognises only countries on the site's list", () => {
    expect(countryName("GB")).toBe("United Kingdom");
    for (const bad of ["gb", "XX", "GBR", "", null, "Brazil"])
      expect(countryName(bad)).toBeNull();
  });
  it("folds groups smaller than the threshold into one row", () => {
    const rows = [
      { key: "a", count: MIN_GROUP },
      { key: "b", count: MIN_GROUP - 1 },
      { key: "c", count: 1 },
    ];
    const result = suppress(rows, (small) => ({
      key: "other",
      count: small.reduce((n, r) => n + r.count, 0),
    }));
    expect(result).toEqual({
      rows: [
        { key: "a", count: MIN_GROUP },
        { key: "other", count: MIN_GROUP },
      ],
      suppressed: 2,
    });
    expect(
      suppress([{ key: "a", count: 9 }], () => ({ key: "x", count: 0 })),
    ).toEqual({ rows: [{ key: "a", count: 9 }], suppressed: 0 });
  });
});

describe("data coverage evaluation", () => {
  const inventory = (extra: Partial<Inventory> = {}): Inventory => ({
    accounts: 10,
    accounts_since: new Date("2026-08-01T00:00:00Z"),
    with_campaign: 10,
    with_country: 4,
    billing_events: 50,
    billing_since: new Date("2026-08-02T00:00:00Z"),
    receipts: 60,
    ledger_entries: 20,
    live_entries: 0,
    unclassified_payments: 3,
    failures: 1,
    history_rows: 10,
    subscriptions: 5,
    active_without_contract: 0,
    listening_events: 0,
    published_stories: 30,
    stories_with_world: 0,
    ...extra,
  });
  const starts = new Map([
    ["payment_ledger", new Date("2026-09-01T00:00:00Z")],
    ["subscription_contracts", new Date("2026-09-01T00:00:00Z")],
    ["subscription_history", new Date("2026-09-01T00:00:00Z")],
    ["billing_reason", new Date("2026-09-20T00:00:00Z")],
    ["payment_failures", new Date("2026-09-20T00:00:00Z")],
  ]);
  const status = (domains: ReturnType<typeof evaluateCoverage>) =>
    Object.fromEntries(domains.map((d) => [d.id, d.status]));
  it("states partial and unavailable areas honestly", () => {
    const d = evaluateCoverage(inventory(), starts);
    expect(status(d)).toEqual({
      accounts: "available",
      billing: "available",
      revenue: "partial", // Billing events predate the ledger.
      "new-renewal": "partial",
      "failed-value": "available",
      mrr: "available",
      history: "partial",
      cohorts: "available",
      campaigns: "available",
      geography: "partial",
      listening: "unavailable",
      "webhook-failures": "unavailable",
      environment: "available",
    });
    expect(d.find((x) => x.id === "listening")?.detail).toContain(
      "Awaiting approved listening telemetry",
    );
    expect(d.find((x) => x.id === "geography")?.detail).toContain("40%");
  });
  it("marks live data, missing contracts and missing migrations", () => {
    const d = status(
      evaluateCoverage(
        inventory({
          live_entries: 2,
          active_without_contract: 1,
          with_campaign: 0,
          with_country: 0,
          billing_since: new Date("2026-09-02T00:00:00Z"),
        }),
        new Map([...starts, ["listening", new Date("2026-09-25T00:00:00Z")]]),
      ),
    );
    expect(d).toMatchObject({
      environment: "partial",
      mrr: "partial",
      campaigns: "unavailable",
      geography: "unavailable",
      revenue: "available",
      listening: "available",
    });
    expect(status(evaluateCoverage(inventory(), new Map()))).toMatchObject({
      revenue: "unavailable",
      "failed-value": "unavailable",
      mrr: "unavailable",
      history: "unavailable",
      "new-renewal": "unavailable",
    });
  });
});

describe("aggregate CSV exports", () => {
  it("quotes cells and neutralises spreadsheet formulas", () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("=SUM(A1)")).toBe(`"'=SUM(A1)"`);
    expect(csvCell("+44 7700")).toBe(`"'+44 7700"`);
    expect(csvCell("@cmd")).toBe(`"'@cmd"`);
    expect(csvCell("-12.50")).toBe('"-12.50"'); // A signed number stays numeric.
    expect(csvCell("a\nb")).toBe('"a b"');
    expect(csvCell(-3)).toBe("-3");
    expect(csvCell(Number.NaN)).toBe("");
    expect(csvCell(null)).toBe("");
    expect(toCsv([["k", "v"]], ["a"], [[1]])).toBe('"# k","v"\r\n"a"\r\n1\r\n');
  });
  it("formats minor units by currency exponent without floating point", () => {
    expect(minorToDecimal(999, 2)).toBe("9.99");
    expect(minorToDecimal(5, 2)).toBe("0.05");
    expect(minorToDecimal(-1250, 2)).toBe("-12.50");
    expect(minorToDecimal(1500, 0)).toBe("1500");
    expect(minorToDecimal(1500, 3)).toBe("1.500");
  });
  it("allowlists reports and refuses to export unavailable data as an empty file", () => {
    expect(parseReport("revenue")).toBe("revenue");
    for (const bad of ["accounts", "emails", "", null, "__proto__"])
      expect(parseReport(bad)).toBeNull();
    const empty: ConsoleData = { overview: null, intelInstalled: false };
    for (const r of [
      "subscribers",
      "revenue",
      "cohorts",
      "campaigns",
      "coverage",
    ] as const)
      expect(buildExport(r, empty, now.toISOString())).toBeNull();
  });
  it("exports suppressed campaign rows and neutralised labels only", () => {
    const csv = buildExport(
      "campaigns",
      {
        overview: null,
        intelInstalled: true,
        campaigns: {
          period: {
            id: "30d",
            label: "30 days",
            compareLabel: "",
            start: null,
            end: now.toISOString(),
            prevStart: null,
            prevEnd: null,
          },
          suppressed: 2,
          selected: null,
          totals: {
            registrations: 9,
            trials: 0,
            converted: 0,
            paid: 0,
            payingNow: 0,
          },
          rows: [
            {
              key: "free30",
              label: "free30",
              kind: "campaign",
              count: 6,
              registrations: 6,
              trials: 5,
              converted: 2,
              paid: 3,
              payingNow: 2,
              revenue: [{ currency: "gbp", netMinor: 2997 }],
            },
            {
              key: "__grouped__",
              label: "Smaller campaigns (fewer than 5 registrations each)",
              kind: "grouped",
              count: 3,
              registrations: 3,
              trials: 0,
              converted: 0,
              paid: 0,
              payingNow: 0,
              revenue: [],
            },
          ],
        },
      },
      now.toISOString(),
    )!;
    expect(csv).toContain('"free30",6,5,2,3,2,"GBP 29.97"');
    expect(csv).toContain("Smaller campaigns");
    expect(csv).toContain("no personal data");
  });
});
