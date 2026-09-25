import { describe, expect, it } from "vitest";
import { isContentSubscriptionObject } from "./stripeEvents";

describe("merchandise webhook never handles content subscriptions", () => {
  it("recognises Phase 1-5 and superseded Sanity-design subscription objects", () => {
    expect(
      isContentSubscriptionObject({ metadata: { mtm: "subscriptions-v1" } }),
    ).toBe(true);
    expect(
      isContentSubscriptionObject({
        metadata: { checkoutType: "subscription" },
      }),
    ).toBe(true);
  });
  it("leaves merchandise objects alone", () => {
    for (const o of [
      { metadata: {} },
      { metadata: { checkoutType: "shop" } },
      {},
      null,
    ])
      expect(isContentSubscriptionObject(o)).toBe(false);
  });
});
