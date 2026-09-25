import { describe, expect, it } from "vitest";
import {
  churnMonth,
  formatMinor,
  minorExponent,
  mrrStatus,
  rate,
  toMinor,
  windowCoverage,
} from "./finance";

describe("finance reporting rules", () => {
  it("uses Stripe minor units per currency", () => {
    expect(minorExponent("GBP")).toBe(2);
    expect(minorExponent("jpy")).toBe(0);
    expect(minorExponent("kwd")).toBe(3);
    expect(formatMinor(999, "gbp")).toBe("£9.99");
    expect(formatMinor(999, "jpy")).toBe("JP¥999");
    expect(formatMinor(1500, "kwd")).toContain("1.500");
    expect(formatMinor(0, "usd")).toBe("US$0.00");
  });
  it("accepts only exact, safe integer minor amounts", () => {
    expect(toMinor("123")).toBe(123);
    expect(toMinor("832.5")).toBe(833); // Normalised MRR rounds half up to a minor unit.
    expect(toMinor(null)).toBe(0);
    expect(() => toMinor("not-a-number")).toThrow();
    expect(() => toMinor("99999999999999999999")).toThrow();
  });
  it("marks windows partial for pre-coverage receipts, anomalies or gaps", () => {
    expect(
      windowCoverage({ preCoverageReceipts: 0, unmatchedReceipts: 0, gaps: 0 }),
    ).toEqual({ status: "complete", reasons: [] });
    const partial = windowCoverage({
      preCoverageReceipts: 2,
      unmatchedReceipts: 1,
      gaps: 3,
    });
    expect(partial.status).toBe("partial");
    expect(partial.reasons).toHaveLength(3);
    expect(partial.reasons[0]).toContain("predate ledger coverage");
  });
  it("keeps MRR unavailable unless contract amounts exist", () => {
    expect(mrrStatus(0, 0)).toBe("available");
    expect(mrrStatus(3, 3)).toBe("available");
    expect(mrrStatus(3, 1)).toBe("partial");
    expect(mrrStatus(3, 0)).toBe("unavailable");
  });
  it("measures churn only for complete UTC months inside history coverage", () => {
    const start = new Date("2026-09-25T10:00:00Z");
    expect(churnMonth(new Date("2026-10-15T00:00:00Z"), start)).toEqual({
      firstMeasurable: new Date("2026-10-01T00:00:00Z"),
      firstAvailableAt: new Date("2026-11-01T00:00:00Z"),
    });
    expect(churnMonth(new Date("2026-11-01T00:00:00Z"), start)).toEqual({
      start: new Date("2026-10-01T00:00:00Z"),
      end: new Date("2026-11-01T00:00:00Z"),
    });
    // History that begins exactly at a month boundary covers that month.
    expect(
      churnMonth(
        new Date("2026-11-02T00:00:00Z"),
        new Date("2026-10-01T00:00:00Z"),
      ),
    ).toEqual({
      start: new Date("2026-10-01T00:00:00Z"),
      end: new Date("2026-11-01T00:00:00Z"),
    });
    // Year rollover.
    expect(
      churnMonth(
        new Date("2027-01-01T00:00:00Z"),
        new Date("2026-11-30T00:00:00Z"),
      ),
    ).toEqual({
      start: new Date("2026-12-01T00:00:00Z"),
      end: new Date("2027-01-01T00:00:00Z"),
    });
  });
  it("returns no rate for an empty denominator", () => {
    expect(rate(1, 0)).toBeNull();
    expect(rate(1, 3)).toBe(33.3);
  });
});
