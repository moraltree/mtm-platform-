import { describe, expect, it } from "vitest";
import type { ConsoleData } from "../console";
import type { CampaignRow } from "./load";
import {
  EXPORT_REPORTS,
  buildExport,
  exportCampaignRows,
  stepUpSatisfied,
} from "./exports";
import {
  EXPORT_MIN_GROUP,
  INTERNAL_MIN_GROUP,
  MIN_GROUP,
  exportCount,
} from "./rules";

const asOf = "2026-09-25T12:00:00.000Z";
const period = {
  id: "30d" as const,
  label: "30 days",
  compareLabel: "",
  start: null,
  end: asOf,
  prevStart: null,
  prevEnd: null,
};
const campaign = (
  key: string,
  registrations: number,
  extra: Partial<CampaignRow> = {},
): CampaignRow => ({
  key,
  label: key,
  kind: "campaign",
  count: registrations,
  registrations,
  trials: registrations,
  converted: 0,
  paid: registrations,
  payingNow: 0,
  revenue: [{ currency: "gbp", netMinor: registrations * 999 }],
  ...extra,
});
const lines = (csv: string) => csv.split("\r\n");

describe("approved small-group policy", () => {
  it("keeps 5 inside the console and 10 for anything exported", () => {
    expect(INTERNAL_MIN_GROUP).toBe(5);
    expect(MIN_GROUP).toBe(5);
    expect(EXPORT_MIN_GROUP).toBe(10);
  });
  it("masks counts from 1 to 9 (and signed movements) but not 0 or 10+", () => {
    expect(exportCount(0)).toBe(0);
    for (const n of [1, 5, 9, -1, -9]) expect(exportCount(n)).toBe("<10");
    for (const n of [10, 11, 250, -10]) expect(exportCount(n)).toBe(n);
  });
  it("classifies every current report as aggregate and never releases sensitive ones", () => {
    for (const d of Object.values(EXPORT_REPORTS))
      expect(d.sensitivity).toBe("aggregate");
    expect(stepUpSatisfied("aggregate")).toBe(true);
    expect(stepUpSatisfied("sensitive")).toBe(false);
  });
});

describe("campaign export suppression at 10", () => {
  it("keeps campaigns of 10 or more and groups the rest", () => {
    const rows = exportCampaignRows([
      campaign("big", 40),
      campaign("mid", 12),
      campaign("small", 6),
      campaign("tiny", 5),
    ]);
    expect(rows.map((r) => [r.key, r.registrations])).toEqual([
      ["big", 40],
      ["mid", 12],
      ["__grouped__", 11],
    ]);
  });
  it("adds the smallest kept campaign when the group is still under 10", () => {
    const rows = exportCampaignRows([
      campaign("big", 40),
      campaign("mid", 12),
      campaign("small", 6),
    ]);
    // 6 alone could be recovered from a total; fold "mid" in as well.
    expect(rows.map((r) => [r.key, r.registrations])).toEqual([
      ["big", 40],
      ["__grouped__", 18],
    ]);
    expect(rows[1].revenue).toEqual([{ currency: "gbp", netMinor: 18 * 999 }]);
  });
  it("re-suppresses the console's own under-5 bucket", () => {
    const grouped: CampaignRow = {
      ...campaign("__grouped__", 4),
      kind: "grouped",
      label: "Smaller campaigns (fewer than 5 registrations each)",
    };
    const rows = exportCampaignRows([campaign("big", 30), grouped]);
    expect(rows.map((r) => r.label)).toEqual([
      "Smaller campaigns (fewer than 10 registrations each)",
    ]);
    expect(rows[0].registrations).toBe(34);
  });
  it("withholds revenue for groups with fewer than 10 payers", () => {
    const csv = buildExport(
      "campaigns",
      {
        overview: null,
        intelInstalled: true,
        campaigns: {
          period,
          suppressed: 0,
          selected: null,
          totals: {
            registrations: 50,
            trials: 0,
            converted: 0,
            paid: 0,
            payingNow: 0,
          },
          rows: [campaign("big", 50, { paid: 3, trials: 20, converted: 2 })],
        },
      },
      asOf,
    )!;
    expect(csv).toContain('"big",50,20,"<10","<10",0,"withheld (<10)"');
    expect(csv).not.toContain("GBP");
  });
});

describe("other exports at 10", () => {
  it("masks small subscriber metrics and their percentage change", () => {
    const csv = buildExport(
      "subscribers",
      {
        intelInstalled: true,
        overview: {
          counts: { paid: 7, monthly: 12, annual: 0 },
        } as unknown as ConsoleData["overview"],
        subscribers: {
          period,
          metrics: {
            registrations: {
              current: 40,
              comparison: { previous: 20, change: 100 },
            },
            trialsStarted: {
              current: 4,
              comparison: { previous: 20, change: -80 },
            },
          },
          netSubscriptions: { current: -3, previous: 12 },
          scheduled: { accountsNow: 0, inPeriod: null },
        } as unknown as ConsoleData["subscribers"],
      },
      asOf,
    )!;
    expect(csv).toContain('"registrations",40,20,100');
    expect(csv).toContain('"trialsStarted","<10",20,');
    expect(csv).not.toContain("-80");
    expect(csv).toContain('"active_paid_subscribers_now","<10",,');
    expect(csv).toContain('"monthly_paid_accounts_now",12,,');
    expect(csv).toContain('"annual_paid_accounts_now",0,,');
    expect(csv).toContain('"net_subscription_movement","<10",12,');
  });
  it("withholds revenue amounts built from fewer than 10 payments", () => {
    const currency = (payments: number) => ({
      currency: "gbp",
      payments,
      grossMinor: payments * 999,
      newMinor: 0,
      renewalMinor: 0,
      unclassifiedMinor: payments * 999,
      monthlyMinor: payments * 999,
      annualMinor: 0,
      refundedMinor: 0,
      disputesLostMinor: 0,
      netMinor: payments * 999,
    });
    const csv = buildExport(
      "revenue",
      {
        overview: null,
        intelInstalled: true,
        revenue: {
          period,
          ledgerStart: asOf,
          windows: [
            {
              name: "this_period",
              coverage: { status: "complete" },
              currencies: [currency(12)],
            },
            {
              name: "previous",
              coverage: { status: "complete" },
              currencies: [currency(2)],
            },
          ],
        } as unknown as ConsoleData["revenue"],
      },
      asOf,
    )!;
    expect(csv).toContain('"this_period","GBP","complete",12,"119.88"');
    const previous = lines(csv).find((l) => l.startsWith('"previous"'))!;
    expect(previous).toContain('"<10"');
    expect(previous).not.toMatch(/19\.98/);
    expect(previous.match(/withheld \(<10\)/g)).toHaveLength(9);
  });
  it("masks every cell of a registration cohort smaller than 10", () => {
    const csv = buildExport(
      "cohorts",
      {
        overview: null,
        intelInstalled: true,
        cohorts: {
          registration: [
            {
              month: "2026-08",
              registered: 30,
              trials: 25,
              converted: 3,
              everPaid: 11,
              payingNow: 10,
              cancelled: 0,
              reactivated: 1,
            },
            {
              month: "2026-09",
              registered: 4,
              trials: 0,
              converted: 0,
              everPaid: 0,
              payingNow: 0,
              cancelled: 0,
              reactivated: 0,
            },
          ],
        } as unknown as ConsoleData["cohorts"],
      },
      asOf,
    )!;
    expect(csv).toContain('"2026-08",30,25,"<10",11,10,0,"<10"');
    expect(csv).toContain(
      '"2026-09","<10","<10","<10","<10","<10","<10","<10"',
    );
  });
  it("states the external threshold in every export", () => {
    const csv = buildExport(
      "coverage",
      {
        overview: null,
        intelInstalled: true,
        coverage: {
          domains: [
            {
              id: "accounts",
              title: "Accounts",
              status: "available",
              since: asOf,
              source: "mtm_accounts",
              detail:
                "7 accounts recorded since the subscription system began.",
            },
          ],
        } as unknown as ConsoleData["coverage"],
      },
      asOf,
    )!;
    expect(csv).toContain("External minimum group size 10");
    expect(csv).not.toContain("7 accounts");
  });
});
