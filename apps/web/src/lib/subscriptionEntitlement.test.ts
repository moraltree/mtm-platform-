import { describe, it, expect } from "vitest";
import {
  hasPaidAccess,
  hasPaidSubscriptionAccess,
  hasTrialAccess,
  type SubscriptionStatus,
} from "./subscriptionEntitlement";

/**
 * Entitlement logic tests — covers which subscription statuses grant access
 * and which are correctly denied.
 *
 * Key invariants:
 * - hasPaidAccess: active OR trialing = true; everything else = false
 * - hasPaidSubscriptionAccess: active only = true (trialing = false)
 * - hasTrialAccess: trialing only = true (active = false)
 *
 * The distinction between hasPaidSubscriptionAccess and hasTrialAccess
 * exists to ensure trial starts never trigger paid-conversion rewards.
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

  it("never treats past_due as active — failed/unpaid subscriptions cannot grant access", () => {
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
    // This invariant protects against paid-conversion rewards being triggered
    // at the moment a free trial starts.
    expect(hasPaidSubscriptionAccess("trialing")).toBe(false);
  });
});

describe("hasTrialAccess", () => {
  it("returns true for trialing — free trial grants content access", () => {
    expect(hasTrialAccess("trialing")).toBe(true);
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

describe("entitlement distinction: trial vs paid", () => {
  it("hasPaidAccess covers both active and trialing (content always accessible)", () => {
    expect(hasPaidAccess("active")).toBe(true);
    expect(hasPaidAccess("trialing")).toBe(true);
  });

  it("only hasPaidSubscriptionAccess distinguishes a paying customer from a trialist", () => {
    expect(hasPaidSubscriptionAccess("active")).toBe(true);
    expect(hasPaidSubscriptionAccess("trialing")).toBe(false);
  });

  it("only hasTrialAccess identifies a trialist specifically", () => {
    expect(hasTrialAccess("trialing")).toBe(true);
    expect(hasTrialAccess("active")).toBe(false);
  });

  it("a trialist never simultaneously satisfies hasPaidSubscriptionAccess", () => {
    expect(hasPaidSubscriptionAccess("trialing")).toBe(false);
    expect(hasTrialAccess("trialing")).toBe(true);
  });
});
