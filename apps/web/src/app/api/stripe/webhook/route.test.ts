import { afterEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";

// Fake fixture values only.
const shopSecret = "whsec_FIXTUREONLYSHOPSECRET";
const stripe = new Stripe("sk_test_FIXTUREONLY0000");
const signed = (event: object, secret = shopSecret) => {
  const payload = JSON.stringify(event);
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    body: payload,
    headers: {
      "stripe-signature": stripe.webhooks.generateTestHeaderString({
        payload,
        secret,
      }),
    },
  });
};
async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v as string);
  return (await import("./route")).POST;
}

describe("dormant merchandise webhook (Phase 5 reconciliation)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is inert with only the subscription endpoint's secret configured", async () => {
    const POST = await load({
      STRIPE_SECRET_KEY: "sk_test_FIXTUREONLY0000",
      STRIPE_WEBHOOK_SECRET: shopSecret,
      STRIPE_SHOP_WEBHOOK_SECRET: undefined,
    });
    const r = await POST(
      signed({ id: "evt_1", type: "charge.refunded", data: { object: {} } }),
    );
    expect(r.status).toBe(503);
  });

  it.each([
    ["customer.subscription.deleted", { id: "sub_1", metadata: {} }],
    ["customer.subscription.updated", { id: "sub_1", metadata: {} }],
    [
      "checkout.session.completed",
      { id: "cs_1", metadata: { mtm: "subscriptions-v1" } },
    ],
    [
      "checkout.session.completed",
      { id: "cs_2", metadata: { checkoutType: "subscription" } },
    ],
  ])(
    "acknowledges but ignores %s for content subscriptions",
    async (type, object) => {
      const POST = await load({
        STRIPE_SECRET_KEY: "sk_test_FIXTUREONLY0000",
        STRIPE_SHOP_WEBHOOK_SECRET: shopSecret,
      });
      const r = await POST(signed({ id: "evt_2", type, data: { object } }));
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ received: true, ignored: true });
    },
  );
});
