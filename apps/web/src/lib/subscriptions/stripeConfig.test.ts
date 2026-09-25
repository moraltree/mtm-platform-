import { describe, expect, it } from "vitest";
import {
  LEGACY_VARIABLES,
  assertStripeConfig,
  stripeConfigIssues,
} from "./stripeConfig.mjs";

// Fake fixture values only.
const valid = {
  STRIPE_SECRET_KEY: "sk_test_FIXTUREONLY0000",
  STRIPE_WEBHOOK_SECRET: "whsec_FIXTUREONLYFIXTUREONLY",
  STRIPE_ACCOUNT_ID: "acct_FIXTURE0001",
  STRIPE_PRICE_MONTHLY: "price_FIXTUREMONTHLY",
  STRIPE_PRICE_ANNUAL: "price_FIXTUREANNUAL",
};
const issues = (patch: Record<string, string | undefined>) =>
  stripeConfigIssues({ ...valid, ...patch });

describe("Stripe TEST configuration validation", () => {
  it("accepts one complete, consistent TEST configuration", () => {
    expect(stripeConfigIssues(valid)).toEqual([]);
    expect(() => assertStripeConfig(valid)).not.toThrow();
    expect(
      stripeConfigIssues({
        ...valid,
        STRIPE_SECRET_KEY: "rk_test_FIXTUREONLY0000",
      }),
    ).toEqual([]);
  });

  it("rejects live, malformed and missing credentials", () => {
    expect(issues({ STRIPE_SECRET_KEY: "sk_live_FIXTUREONLY0000" })).toEqual([
      "STRIPE_SECRET_KEY is a LIVE key; only TEST keys are accepted",
    ]);
    expect(issues({ STRIPE_SECRET_KEY: "pk_test_FIXTUREONLY0000" })[0]).toMatch(
      /not a Stripe TEST/,
    );
    expect(issues({ STRIPE_SECRET_KEY: undefined })[0]).toMatch(/missing/);
    expect(issues({ STRIPE_WEBHOOK_SECRET: "secret" })[0]).toMatch(
      /signing secret/,
    );
    expect(issues({ STRIPE_ACCOUNT_ID: undefined })[0]).toMatch(
      /STRIPE_ACCOUNT_ID is missing/,
    );
    expect(issues({ STRIPE_ACCOUNT_ID: "Moral Tree" })[0]).toMatch(
      /not a Stripe account ID/,
    );
  });

  it("rejects missing, malformed and duplicate Prices", () => {
    expect(issues({ STRIPE_PRICE_ANNUAL: undefined })).toEqual([
      "STRIPE_PRICE_ANNUAL is missing",
    ]);
    expect(issues({ STRIPE_PRICE_MONTHLY: "prod_FIXTURE00" })[0]).toMatch(
      /not a Price ID/,
    );
    expect(issues({ STRIPE_PRICE_ANNUAL: valid.STRIPE_PRICE_MONTHLY })).toEqual(
      ["STRIPE_PRICE_MONTHLY and STRIPE_PRICE_ANNUAL must differ"],
    );
  });

  it("fails closed while any legacy/misnamed variable is present", () => {
    for (const [legacy, canonical] of Object.entries(LEGACY_VARIABLES)) {
      const found = issues({ [legacy]: "price_FIXTURELEGACY" });
      expect(found).toHaveLength(1);
      expect(found[0]).toContain(legacy);
      expect(found[0]).toContain(canonical);
    }
    // Even an empty legacy value is an inconsistent environment.
    expect(issues({ STRIPE_MONTHLY_PRICE_ID: "" })).toHaveLength(1);
  });

  it("never includes a configured value in any message", () => {
    const canary = "CANARYVALUE12345";
    const env = {
      STRIPE_SECRET_KEY: `sk_live_${canary}`,
      STRIPE_WEBHOOK_SECRET: `bad_${canary}`,
      STRIPE_ACCOUNT_ID: `acct-${canary}`,
      STRIPE_PRICE_MONTHLY: `x_${canary}`,
      STRIPE_PRICE_ANNUAL: `x_${canary}`,
      STRIPE_MONTHLY_PRICE_ID: `price_${canary}`,
    };
    expect(stripeConfigIssues(env).join(" ")).not.toContain(canary);
    expect(() => assertStripeConfig(env)).toThrow(
      /Stripe test configuration invalid/,
    );
    try {
      assertStripeConfig(env);
    } catch (error) {
      expect((error as Error).message).not.toContain(canary);
    }
  });
});
