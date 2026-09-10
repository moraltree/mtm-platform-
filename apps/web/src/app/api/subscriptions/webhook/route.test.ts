import { beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
const processEvent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/subscriptions/webhook", () => ({
  processSubscriptionEvent: processEvent,
}));
import { POST } from "./route";
const secret = "whsec_fixture_only";
const stripe = new Stripe("sk_test_fixture_only");
describe("subscription webhook signature boundary", () => {
  beforeEach(() => {
    process.env.SUBSCRIPTIONS_ENABLED = "true";
    process.env.STRIPE_SECRET_KEY = "sk_test_fixture_only";
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    processEvent.mockReset().mockResolvedValue(undefined);
  });
  const request = (live = false, signed = true) => {
    const payload = JSON.stringify({
      id: "evt_fixture",
      type: "invoice.paid",
      livemode: live,
      data: { object: {} },
    });
    return new Request("http://localhost/api/subscriptions/webhook", {
      method: "POST",
      body: payload,
      headers: signed
        ? {
            "stripe-signature": stripe.webhooks.generateTestHeaderString({
              payload,
              secret,
            }),
          }
        : {},
    });
  };
  it("rejects missing and invalid signatures", async () => {
    expect((await POST(request(false, false))).status).toBe(400);
    const tampered = request();
    tampered.headers.set("stripe-signature", "invalid");
    expect((await POST(tampered)).status).toBe(400);
    expect(processEvent).not.toHaveBeenCalled();
  });
  it("accepts verified test events", async () =>
    expect((await POST(request())).status).toBe(200));
  it("rejects signed live-mode events", async () => {
    expect((await POST(request(true))).status).toBe(400);
    expect(processEvent).not.toHaveBeenCalled();
  });
  it("asks Stripe to retry transient processing failures", async () => {
    processEvent.mockRejectedValue(new Error("database unavailable"));
    expect((await POST(request())).status).toBe(503);
  });
  it("refuses live credentials without sending a request", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_fixture_only";
    expect((await POST(request())).status).toBe(503);
  });
});
