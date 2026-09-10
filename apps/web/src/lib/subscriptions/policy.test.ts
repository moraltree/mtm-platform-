import { describe, expect, it } from "vitest";
import {
  entitlement,
  parsePlan,
  testSecret,
  trialDays,
  trialDeadline,
} from "./policy";

describe("subscription policy", () => {
  it.each([-1, 31, 365, 1.5, NaN, "invalid", ""])(
    "rejects invalid trial duration %s",
    (days) => expect(() => trialDays(days)).toThrow(),
  );
  it.each([0, 1, 14, 30])("accepts approved duration %s", (days) =>
    expect(trialDays(days)).toBe(days),
  );
  it("uses calendar days across month and year boundaries", () => {
    expect(
      trialDeadline(new Date("2026-12-20T15:00:00Z"), 30).toISOString(),
    ).toBe("2027-01-19T15:00:00.000Z");
  });
  it("rejects arbitrary Stripe price identifiers", () => {
    expect(() => parsePlan("price_attacker")).toThrow();
    expect(parsePlan("annual")).toBe("annual");
  });
  it("rejects live and malformed keys", () => {
    expect(testSecret("sk_live_not-a-real-key")).toBe(false);
    expect(testSecret(undefined)).toBe(false);
    expect(testSecret("sk_test_fixture")).toBe(true);
  });
  it("never grants paid access from active status without payment", () => {
    expect(entitlement({ status: "active" })).toBe("none");
  });
  it("grants full paid access immediately during a trial", () => {
    expect(
      entitlement(
        {
          status: "active",
          paidUntil: new Date("2026-10-01"),
          trialStatus: "active",
          trialEnd: new Date("2026-09-30"),
        },
        new Date("2026-09-10"),
      ),
    ).toBe("paid");
  });
  it.each(["past_due", "unpaid", "canceled", "incomplete", "paused"])(
    "denies paid access for %s",
    (status) => {
      expect(
        entitlement(
          { status, paidUntil: new Date("2027-01-01") },
          new Date("2026-09-10"),
        ),
      ).toBe("none");
    },
  );
  it("expires trial access at the exact boundary, independently of consumption or jobs", () => {
    const state = {
      trialStatus: "active",
      trialEnd: new Date("2026-09-10T12:00:00Z"),
    };
    expect(entitlement(state, new Date("2026-09-10T11:59:59Z"))).toBe("trial");
    expect(entitlement(state, new Date("2026-09-10T12:00:00Z"))).toBe("none");
  });
  it("blocks disputed accounts regardless of remaining trial or paid time", () => {
    expect(
      entitlement(
        {
          blocked: true,
          status: "active",
          paidUntil: new Date("2027-01-01"),
          trialStatus: "active",
          trialEnd: new Date("2027-01-01"),
        },
        new Date("2026-09-10"),
      ),
    ).toBe("none");
  });
});
