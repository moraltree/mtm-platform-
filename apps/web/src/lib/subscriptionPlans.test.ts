import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isValidPlan,
  getPriceIdForPlan,
  areSubscriptionPlansConfigured,
} from "./subscriptionPlans";

describe("isValidPlan", () => {
  it("accepts MONTHLY", () => {
    expect(isValidPlan("MONTHLY")).toBe(true);
  });

  it("accepts ANNUAL", () => {
    expect(isValidPlan("ANNUAL")).toBe(true);
  });

  it("rejects an arbitrary Stripe Price ID", () => {
    expect(isValidPlan("price_1ABCDEFGHIjklmno")).toBe(false);
  });

  it("rejects lowercase", () => {
    expect(isValidPlan("monthly")).toBe(false);
    expect(isValidPlan("annual")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidPlan("")).toBe(false);
  });

  it("rejects non-string", () => {
    expect(isValidPlan(undefined)).toBe(false);
    expect(isValidPlan(null)).toBe(false);
    expect(isValidPlan(42)).toBe(false);
  });
});

describe("getPriceIdForPlan", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.STRIPE_PRICE_MONTHLY = "price_test_monthly";
    process.env.STRIPE_PRICE_ANNUAL = "price_test_annual";
  });

  afterEach(() => {
    process.env.STRIPE_PRICE_MONTHLY = originalEnv.STRIPE_PRICE_MONTHLY;
    process.env.STRIPE_PRICE_ANNUAL = originalEnv.STRIPE_PRICE_ANNUAL;
  });

  it("returns the MONTHLY price ID from environment", () => {
    expect(getPriceIdForPlan("MONTHLY")).toBe("price_test_monthly");
  });

  it("returns the ANNUAL price ID from environment", () => {
    expect(getPriceIdForPlan("ANNUAL")).toBe("price_test_annual");
  });

  it("returns null when the env var is not set", () => {
    delete process.env.STRIPE_PRICE_MONTHLY;
    expect(getPriceIdForPlan("MONTHLY")).toBeNull();
  });
});

describe("areSubscriptionPlansConfigured", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env.STRIPE_PRICE_MONTHLY = originalEnv.STRIPE_PRICE_MONTHLY;
    process.env.STRIPE_PRICE_ANNUAL = originalEnv.STRIPE_PRICE_ANNUAL;
  });

  it("returns true when both price IDs are set", () => {
    process.env.STRIPE_PRICE_MONTHLY = "price_monthly";
    process.env.STRIPE_PRICE_ANNUAL = "price_annual";
    expect(areSubscriptionPlansConfigured()).toBe(true);
  });

  it("returns false when MONTHLY is missing", () => {
    delete process.env.STRIPE_PRICE_MONTHLY;
    process.env.STRIPE_PRICE_ANNUAL = "price_annual";
    expect(areSubscriptionPlansConfigured()).toBe(false);
  });

  it("returns false when ANNUAL is missing", () => {
    process.env.STRIPE_PRICE_MONTHLY = "price_monthly";
    delete process.env.STRIPE_PRICE_ANNUAL;
    expect(areSubscriptionPlansConfigured()).toBe(false);
  });

  it("returns false when both are missing", () => {
    delete process.env.STRIPE_PRICE_MONTHLY;
    delete process.env.STRIPE_PRICE_ANNUAL;
    expect(areSubscriptionPlansConfigured()).toBe(false);
  });
});
