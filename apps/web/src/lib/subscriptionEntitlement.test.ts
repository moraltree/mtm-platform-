import { describe, it, expect } from "vitest";
import { hasPaidAccess, type SubscriptionStatus } from "./subscriptionEntitlement";

/**
 * Entitlement logic tests — covers which subscription statuses grant access
 * and which are correctly denied. The key invariant: only `active` and
 * `trialing` are access-granting; every other state is explicitly not.
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
