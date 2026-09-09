import { describe, it, expect } from "vitest";
import {
  hasPaidAccess,
  hasPaidSubscriptionAccess,
  hasTrialAccess,
  type SubscriptionStatus,
} from "./subscriptionEntitlement";

/**
 * Entitlement logic tests.
 *
 * Key invariants:
 * - hasPaidAccess: active OR trialing = true (any form of access)
 * - hasPaidSubscriptionAccess: active only = true (paid subscriber)
 * - hasTrialAccess: trialing only = true (and not expired)
 *
 * Trial access and paid access are DISTINCT entitlement tiers.
 * A trial subscriber never satisfies hasPaidSubscriptionAccess().
 */

describe("hasPaidAccess", () => {
  const allowed: SubscriptionStatus[] = ["active", "trialing"];
  const denied: SubscriptionStatus[] = [
    "past_due",
    "incomplete",
    "cancelled",
    "unknown",
  ];

  for (const status of allowed) {
    it(`grants access for status "${status}"`, () => {
      expect(hasPaidAccess(status)).toBe(true);
    });
  }

  for (const status of denied) {
    it(`denies access for status "${status}"`, () => {
      expect(hasPaidAccess(status)).toBe(false);
    });
  }

  it("never treats past_due as active — failed payments cannot grant access", () => {
    expect(hasPaidAccess("past_due")).toBe(false);
  });

  it("never treats cancelled as active", () => {
    expect(hasPaidAccess("cancelled")).toBe(false);
  });

  it("never treats incomplete as active", () => {
    expect(hasPaidAccess("incomplete")).toBe(false);
  });

  it("never treats unknown as active", () => {
    expect(hasPaidAccess("unknown")).toBe(false);
  });
});

describe("hasPaidSubscriptionAccess", () => {
  it("returns true for active — genuine paid subscriber", () => {
    expect(hasPaidSubscriptionAccess("active")).toBe(true);
  });

  it("returns false for trialing — trial is NOT a paid subscription", () => {
    expect(hasPaidSubscriptionAccess("trialing")).toBe(false);
  });

  const nonPaidStatuses: SubscriptionStatus[] = [
    "past_due",
    "incomplete",
    "cancelled",
    "unknown",
  ];
  for (const status of nonPaidStatuses) {
    it(`returns false for "${status}"`, () => {
      expect(hasPaidSubscriptionAccess(status)).toBe(false);
    });
  }

  it("trial start does NOT constitute a paid conversion (hasPaidSubscriptionAccess=false while trialing)", () => {
    expect(hasPaidSubscriptionAccess("trialing")).toBe(false);
  });
});

describe("hasTrialAccess — status-only check (no expiry)", () => {
  it("returns true for trialing with no trialEnd (no expiry specified)", () => {
    expect(hasTrialAccess("trialing")).toBe(true);
  });

  it("returns true for trialing with undefined trialEnd", () => {
    expect(hasTrialAccess("trialing", undefined)).toBe(true);
  });

  it("returns true for trialing with null trialEnd", () => {
    expect(hasTrialAccess("trialing", null)).toBe(true);
  });

  it("returns false for active — active subscriber is not on a trial", () => {
    expect(hasTrialAccess("active")).toBe(false);
  });

  const nonTrialStatuses: SubscriptionStatus[] = [
    "past_due",
    "incomplete",
    "cancelled",
    "unknown",
  ];
  for (const status of nonTrialStatuses) {
    it(`returns false for "${status}"`, () => {
      expect(hasTrialAccess(status)).toBe(false);
    });
  }
});

describe("hasTrialAccess — expiry-aware check", () => {
  const FUTURE_DATE = new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString();
  const PAST_DATE = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

  it("returns true when trialing and trialEnd is in the future (Day 1)", () => {
    expect(hasTrialAccess("trialing", FUTURE_DATE)).toBe(true);
  });

  it("returns true when trialing and trialEnd is in the future (Day 29)", () => {
    const twentyNineDays = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString();
    expect(hasTrialAccess("trialing", twentyNineDays)).toBe(true);
  });

  it("returns false when trialing and trialEnd is in the past (trial expired)", () => {
    expect(hasTrialAccess("trialing", PAST_DATE)).toBe(false);
  });

  it("30-day trial expiry: returns false after trialEnd has passed", () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    expect(hasTrialAccess("trialing", thirtyOneDaysAgo)).toBe(false);
  });

  it("returns false for non-trialing status regardless of trialEnd", () => {
    expect(hasTrialAccess("active", FUTURE_DATE)).toBe(false);
    expect(hasTrialAccess("cancelled", FUTURE_DATE)).toBe(false);
  });
});

describe("entitlement distinction: trial vs paid", () => {
  it("hasPaidAccess covers both active and trialing (any form of access)", () => {
    expect(hasPaidAccess("active")).toBe(true);
    expect(hasPaidAccess("trialing")).toBe(true);
  });

  it("hasPaidSubscriptionAccess distinguishes a paying customer from a trialist", () => {
    expect(hasPaidSubscriptionAccess("active")).toBe(true);
    expect(hasPaidSubscriptionAccess("trialing")).toBe(false);
  });

  it("hasTrialAccess identifies a trialist specifically", () => {
    expect(hasTrialAccess("trialing")).toBe(true);
    expect(hasTrialAccess("active")).toBe(false);
  });

  it("a trialist never simultaneously satisfies hasPaidSubscriptionAccess", () => {
    expect(hasPaidSubscriptionAccess("trialing")).toBe(false);
    expect(hasTrialAccess("trialing")).toBe(true);
  });

  it("an expired trial satisfies neither hasPaidSubscriptionAccess nor hasTrialAccess", () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    expect(hasPaidSubscriptionAccess("trialing")).toBe(false);
    expect(hasTrialAccess("trialing", pastDate)).toBe(false);
  });
});
