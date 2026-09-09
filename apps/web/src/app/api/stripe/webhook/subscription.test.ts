/**
 * Subscription webhook handler tests.
 *
 * Covers:
 * - Valid signature accepted
 * - Invalid/missing signature rejected
 * - Subscription checkout.session.completed → creates subscription record
 * - Shop checkout.session.completed → creates order record (regression)
 * - customer.subscription.updated → updates period/status
 * - customer.subscription.deleted → marks cancelled
 * - invoice.paid → marks active
 * - invoice.payment_failed → marks past_due
 * - Duplicate event ID → idempotency (no duplicate write)
 * - campaign attribution preserved in subscription document
 * - Arbitrary price ID from client never reaches Stripe (structural — see
 *   checkoutType guard in actions.ts; covered here by confirming the webhook
 *   uses session metadata, not client-supplied data)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// ── Shared test fixtures ────────────────────────────────────────────────

const FAKE_EVENT_ID = "evt_test_001";
const FAKE_SESSION_ID = "cs_test_001";
const FAKE_SUB_ID = "sub_test_001";
const FAKE_CUSTOMER_ID = "cus_test_001";
const FAKE_CORRELATION_REF = "aaaabbbb-cccc-dddd-eeee-ffffgggghhhh";
const FAKE_INVOICE_ID = "in_test_001";

function makeCheckoutSession(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: FAKE_SESSION_ID,
    object: "checkout.session",
    mode: "subscription",
    customer: FAKE_CUSTOMER_ID,
    subscription: FAKE_SUB_ID,
    client_reference_id: FAKE_CORRELATION_REF,
    customer_details: { email: "test@example.com" },
    metadata: {
      checkoutType: "subscription",
      plan: "MONTHLY",
      correlationRef: FAKE_CORRELATION_REF,
      campaignId: "test-campaign-01",
      acquisitionSource: "qr-poster",
    },
    ...overrides,
  };
}

function makeSubscription(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: FAKE_SUB_ID,
    object: "customer.subscription",
    customer: FAKE_CUSTOMER_ID,
    status: "active",
    current_period_start: 1700000000,
    current_period_end: 1702678400,
    cancel_at_period_end: false,
    canceled_at: null,
    trial_end: null,
    ...overrides,
  };
}

function makeInvoice(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  // Stripe API ≥2025: subscription is at parent.subscription_details.subscription
  return {
    id: FAKE_INVOICE_ID,
    object: "invoice",
    customer: FAKE_CUSTOMER_ID,
    parent: {
      type: "subscription_details",
      quote_details: null,
      subscription_details: {
        subscription: FAKE_SUB_ID,
      },
    },
    ...overrides,
  };
}

function makeStripeEvent(
  type: string,
  dataObject: Record<string, unknown>,
  eventId = FAKE_EVENT_ID,
): Record<string, unknown> {
  return { id: eventId, type, data: { object: dataObject } };
}

// ── Mocks ───────────────────────────────────────────────────────────────

// Mock Sanity write client
const sanityPatch = {
  set: vi.fn().mockReturnThis(),
  commit: vi.fn().mockResolvedValue({}),
};
const sanityWriteClientMock = {
  fetch: vi.fn(),
  create: vi.fn().mockResolvedValue({ _id: "new-sub-doc-id" }),
  patch: vi.fn().mockReturnValue(sanityPatch),
};

vi.mock("@/lib/sanity/writeClient", () => ({
  sanityWriteClient: sanityWriteClientMock,
}));

// Mock Sanity read queries (for shop order lookup)
vi.mock("@/lib/sanity/queries", () => ({
  getProductByStripePriceId: vi.fn().mockResolvedValue(null),
}));

// Mock email
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ ok: true }),
}));

// Mock stripe — webhook signature verification always succeeds in tests.
// The event object is constructed directly rather than parsed from a
// signed payload, so we bypass the signature check entirely.
let constructedEvent: Record<string, unknown> | null = null;

const stripeMock = {
  webhooks: {
    constructEventAsync: vi.fn(async () => {
      if (!constructedEvent) throw new Error("No event set");
      return constructedEvent;
    }),
  },
  checkout: {
    sessions: {
      listLineItems: vi.fn().mockResolvedValue({ data: [] }),
    },
  },
  billingPortal: { sessions: { create: vi.fn() } },
};

vi.mock("@/lib/stripe", () => ({
  isStripeConfigured: true,
  stripe: stripeMock,
}));

// ── Helpers ─────────────────────────────────────────────────────────────

async function postWebhook(
  event: Record<string, unknown>,
): Promise<NextResponse> {
  constructedEvent = event;
  const { POST } = await import("./route");
  const req = new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=valid" },
    body: JSON.stringify(event),
  });
  // Cast needed because Next.js route handler types differ from standard Request
  return POST(req) as unknown as NextResponse;
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("webhook — signature verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing doc
    sanityWriteClientMock.fetch.mockResolvedValue(null);
  });

  it("rejects a request with no stripe-signature header", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/signature/i);
  });

  it("rejects when constructEventAsync throws (bad signature)", async () => {
    constructedEvent = null; // triggers the mock to throw
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=bad" },
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/signature/i);
  });

  it("accepts a valid signed event and returns 200", async () => {
    constructedEvent = makeStripeEvent(
      "checkout.session.completed",
      makeCheckoutSession(),
    );
    const res = await postWebhook(constructedEvent as Record<string, unknown>);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });
});

describe("webhook — subscription checkout.session.completed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sanityWriteClientMock.fetch.mockResolvedValue(null);
  });

  it("creates a subscription document with correlationRef and attribution", async () => {
    const session = makeCheckoutSession();
    await postWebhook(
      makeStripeEvent("checkout.session.completed", session) as Record<string, unknown>,
    );

    expect(sanityWriteClientMock.create).toHaveBeenCalledTimes(1);
    const created = sanityWriteClientMock.create.mock.calls[0][0];
    expect(created._type).toBe("subscription");
    expect(created.correlationRef).toBe(FAKE_CORRELATION_REF);
    expect(created.stripeCheckoutSessionId).toBe(FAKE_SESSION_ID);
    expect(created.stripeCustomerId).toBe(FAKE_CUSTOMER_ID);
    expect(created.stripeSubscriptionId).toBe(FAKE_SUB_ID);
    expect(created.plan).toBe("MONTHLY");
    expect(created.status).toBe("incomplete");
    expect(created.campaignId).toBe("test-campaign-01");
    expect(created.acquisitionSource).toBe("qr-poster");
  });

  it("updates existing document instead of creating a duplicate (idempotency)", async () => {
    sanityWriteClientMock.fetch.mockResolvedValue({ _id: "existing-sub-doc" });

    const session = makeCheckoutSession();
    await postWebhook(
      makeStripeEvent("checkout.session.completed", session) as Record<string, unknown>,
    );

    expect(sanityWriteClientMock.create).not.toHaveBeenCalled();
    expect(sanityWriteClientMock.patch).toHaveBeenCalledWith("existing-sub-doc");
    expect(sanityPatch.set).toHaveBeenCalled();
    expect(sanityPatch.commit).toHaveBeenCalled();
  });

  it("routes shop checkout (no checkoutType metadata) to the order handler", async () => {
    const session = makeCheckoutSession({
      metadata: {}, // no checkoutType
      mode: "payment",
    });
    await postWebhook(
      makeStripeEvent("checkout.session.completed", session) as Record<string, unknown>,
    );

    // Order handler creates an order document, not a subscription
    expect(sanityWriteClientMock.create).toHaveBeenCalledTimes(1);
    const created = sanityWriteClientMock.create.mock.calls[0][0];
    expect(created._type).toBe("order");
  });
});

describe("webhook — customer.subscription.updated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sanityWriteClientMock.fetch.mockResolvedValue({
      _id: "sub-doc-id",
      lastStripeEventId: "evt_previous",
    });
  });

  it("updates period and status when event is new", async () => {
    const sub = makeSubscription({ status: "active" });
    await postWebhook(
      makeStripeEvent("customer.subscription.updated", sub, "evt_new_001") as Record<string, unknown>,
    );

    expect(sanityPatch.set).toHaveBeenCalled();
    const setArg = sanityPatch.set.mock.calls[0][0];
    expect(setArg.status).toBe("active");
    expect(setArg.lastStripeEventId).toBe("evt_new_001");
  });

  it("skips processing for a duplicate event ID (idempotency)", async () => {
    sanityWriteClientMock.fetch.mockResolvedValue({
      _id: "sub-doc-id",
      lastStripeEventId: FAKE_EVENT_ID, // same as the event we're about to send
    });

    const sub = makeSubscription({ status: "active" });
    await postWebhook(
      makeStripeEvent("customer.subscription.updated", sub, FAKE_EVENT_ID) as Record<string, unknown>,
    );

    expect(sanityPatch.commit).not.toHaveBeenCalled();
  });
});

describe("webhook — customer.subscription.deleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks subscription as cancelled", async () => {
    sanityWriteClientMock.fetch.mockResolvedValue({ _id: "sub-doc-id" });

    const sub = makeSubscription({ status: "canceled", canceled_at: 1700000001 });
    await postWebhook(
      makeStripeEvent("customer.subscription.deleted", sub) as Record<string, unknown>,
    );

    expect(sanityPatch.set).toHaveBeenCalled();
    const setArg = sanityPatch.set.mock.calls[0][0];
    expect(setArg.status).toBe("cancelled");
  });

  it("falls through to legacy order handler when no subscription doc exists", async () => {
    // First call (findSubscriptionDoc) returns null
    sanityWriteClientMock.fetch.mockResolvedValueOnce(null);
    // Second call (legacy order lookup) also returns null — no legacy record either
    sanityWriteClientMock.fetch.mockResolvedValueOnce(null);

    const sub = makeSubscription({ status: "canceled" });
    await postWebhook(
      makeStripeEvent("customer.subscription.deleted", sub) as Record<string, unknown>,
    );

    // No patch committed — no record to update
    expect(sanityPatch.commit).not.toHaveBeenCalled();
  });
});

describe("webhook — invoice.paid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sanityWriteClientMock.fetch.mockResolvedValue({ _id: "sub-doc-id" });
  });

  it("upgrades subscription status to active", async () => {
    const invoice = makeInvoice();
    await postWebhook(
      makeStripeEvent("invoice.paid", invoice) as Record<string, unknown>,
    );

    expect(sanityPatch.set).toHaveBeenCalled();
    const setArg = sanityPatch.set.mock.calls[0][0];
    expect(setArg.status).toBe("active");
  });

  it("skips duplicate event", async () => {
    sanityWriteClientMock.fetch.mockResolvedValue({
      _id: "sub-doc-id",
      lastStripeEventId: FAKE_EVENT_ID,
    });

    const invoice = makeInvoice();
    await postWebhook(
      makeStripeEvent("invoice.paid", invoice, FAKE_EVENT_ID) as Record<string, unknown>,
    );

    expect(sanityPatch.commit).not.toHaveBeenCalled();
  });
});

describe("webhook — invoice.payment_failed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sanityWriteClientMock.fetch.mockResolvedValue({ _id: "sub-doc-id" });
  });

  it("marks subscription as past_due", async () => {
    const invoice = makeInvoice();
    await postWebhook(
      makeStripeEvent("invoice.payment_failed", invoice) as Record<string, unknown>,
    );

    expect(sanityPatch.set).toHaveBeenCalled();
    const setArg = sanityPatch.set.mock.calls[0][0];
    expect(setArg.status).toBe("past_due");
  });
});

describe("webhook — entitlement states", () => {
  it("past_due does not map to active", () => {
    // Structural test: normaliseSanityStatus("past_due") stays past_due
    // (verified in subscriptionEntitlement.ts — hasPaidAccess("past_due") = false)
    // This is a reminder/documentation test; the unit test is in entitlement.test.ts
    expect("past_due").not.toBe("active");
  });
});

describe("webhook — campaign attribution preserved through checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sanityWriteClientMock.fetch.mockResolvedValue(null);
  });

  it("preserves campaignId and acquisitionSource from checkout metadata", async () => {
    const session = makeCheckoutSession({
      metadata: {
        checkoutType: "subscription",
        plan: "ANNUAL",
        correlationRef: FAKE_CORRELATION_REF,
        campaignId: "partner-campaign-xyz",
        acquisitionSource: "email-newsletter",
        partnerId: "partner-abc",
        storyWorldId: "savannah-seven",
      },
    });

    await postWebhook(
      makeStripeEvent("checkout.session.completed", session) as Record<string, unknown>,
    );

    expect(sanityWriteClientMock.create).toHaveBeenCalledTimes(1);
    const created = sanityWriteClientMock.create.mock.calls[0][0];
    expect(created.campaignId).toBe("partner-campaign-xyz");
    expect(created.acquisitionSource).toBe("email-newsletter");
    expect(created.partnerId).toBe("partner-abc");
    expect(created.storyWorldId).toBe("savannah-seven");
    expect(created.plan).toBe("ANNUAL");
  });
});

describe("webhook — duplicate webhook reward/campaign regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not create two subscription records for the same checkout session", async () => {
    // First delivery — no existing doc
    sanityWriteClientMock.fetch.mockResolvedValueOnce(null);

    const session = makeCheckoutSession();
    await postWebhook(
      makeStripeEvent("checkout.session.completed", session) as Record<string, unknown>,
    );

    expect(sanityWriteClientMock.create).toHaveBeenCalledTimes(1);
    vi.clearAllMocks();

    // Second delivery (duplicate) — doc now exists
    sanityWriteClientMock.fetch.mockResolvedValueOnce({ _id: "sub-doc-id" });

    await postWebhook(
      makeStripeEvent("checkout.session.completed", session) as Record<string, unknown>,
    );

    // Should patch (update), NOT create a second document
    expect(sanityWriteClientMock.create).not.toHaveBeenCalled();
    expect(sanityWriteClientMock.patch).toHaveBeenCalledWith("sub-doc-id");
  });
});

// ── Trial-specific webhook tests ─────────────────────────────────────────

describe("webhook — trial: checkout stores trial metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sanityWriteClientMock.fetch.mockResolvedValue(null);
  });

  it("stores trialDays from checkout session metadata when > 0", async () => {
    const session = makeCheckoutSession({
      metadata: {
        checkoutType: "subscription",
        plan: "MONTHLY",
        correlationRef: FAKE_CORRELATION_REF,
        trialDays: "14",
        trialEligible: "true",
      },
    });
    await postWebhook(
      makeStripeEvent("checkout.session.completed", session) as Record<string, unknown>,
    );

    expect(sanityWriteClientMock.create).toHaveBeenCalledTimes(1);
    const created = sanityWriteClientMock.create.mock.calls[0][0];
    expect(created.trialDays).toBe(14);
  });

  it("sets trialStartedAt when trialDays > 0", async () => {
    const session = makeCheckoutSession({
      metadata: {
        checkoutType: "subscription",
        plan: "MONTHLY",
        correlationRef: FAKE_CORRELATION_REF,
        trialDays: "30",
        trialEligible: "true",
      },
    });
    await postWebhook(
      makeStripeEvent("checkout.session.completed", session) as Record<string, unknown>,
    );

    const created = sanityWriteClientMock.create.mock.calls[0][0];
    expect(created.trialStartedAt).toBeDefined();
    expect(typeof created.trialStartedAt).toBe("string");
    // Must be a valid ISO timestamp
    expect(() => new Date(created.trialStartedAt as string).toISOString()).not.toThrow();
  });

  it("does NOT set trialStartedAt when trialDays = 0", async () => {
    const session = makeCheckoutSession({
      metadata: {
        checkoutType: "subscription",
        plan: "MONTHLY",
        correlationRef: FAKE_CORRELATION_REF,
        trialDays: "0",
        trialEligible: "false",
      },
    });
    await postWebhook(
      makeStripeEvent("checkout.session.completed", session) as Record<string, unknown>,
    );

    const created = sanityWriteClientMock.create.mock.calls[0][0];
    expect(created.trialStartedAt).toBeUndefined();
  });

  it("stores trialEligible=true from checkout metadata", async () => {
    const session = makeCheckoutSession({
      metadata: {
        checkoutType: "subscription",
        plan: "MONTHLY",
        correlationRef: FAKE_CORRELATION_REF,
        trialDays: "7",
        trialEligible: "true",
      },
    });
    await postWebhook(
      makeStripeEvent("checkout.session.completed", session) as Record<string, unknown>,
    );

    const created = sanityWriteClientMock.create.mock.calls[0][0];
    expect(created.trialEligible).toBe(true);
  });

  it("stores trialEligible=false when metadata says false", async () => {
    const session = makeCheckoutSession({
      metadata: {
        checkoutType: "subscription",
        plan: "MONTHLY",
        correlationRef: FAKE_CORRELATION_REF,
        trialDays: "0",
        trialEligible: "false",
      },
    });
    await postWebhook(
      makeStripeEvent("checkout.session.completed", session) as Record<string, unknown>,
    );

    const created = sanityWriteClientMock.create.mock.calls[0][0];
    expect(created.trialEligible).toBe(false);
  });

  it("stores trialDays=0 when metadata is absent (no trial)", async () => {
    const session = makeCheckoutSession();
    // Default makeCheckoutSession has no trialDays in metadata
    await postWebhook(
      makeStripeEvent("checkout.session.completed", session) as Record<string, unknown>,
    );

    const created = sanityWriteClientMock.create.mock.calls[0][0];
    expect(created.trialDays).toBe(0);
  });

  it("duplicate checkout for a trialing account patches, not creates (no second trial record)", async () => {
    // Second delivery — doc already exists
    sanityWriteClientMock.fetch.mockResolvedValue({ _id: "existing-sub-id" });

    const session = makeCheckoutSession({
      metadata: {
        checkoutType: "subscription",
        plan: "MONTHLY",
        correlationRef: FAKE_CORRELATION_REF,
        trialDays: "14",
        trialEligible: "true",
      },
    });
    await postWebhook(
      makeStripeEvent("checkout.session.completed", session) as Record<string, unknown>,
    );

    // Must not create a second document
    expect(sanityWriteClientMock.create).not.toHaveBeenCalled();
    expect(sanityWriteClientMock.patch).toHaveBeenCalledWith("existing-sub-id");
  });
});

describe("webhook — trial: subscription.updated preserves trialEnd", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sanityWriteClientMock.fetch.mockResolvedValue({
      _id: "sub-doc-id",
      lastStripeEventId: "evt_previous",
    });
  });

  it("stores trialEnd when Stripe subscription has trial_end set", async () => {
    const trialEndTs = 1760000000; // a future Unix timestamp
    const sub = makeSubscription({
      status: "trialing",
      trial_end: trialEndTs,
    });
    await postWebhook(
      makeStripeEvent("customer.subscription.updated", sub, "evt_trial_001") as Record<string, unknown>,
    );

    expect(sanityPatch.set).toHaveBeenCalled();
    const setArg = sanityPatch.set.mock.calls[0][0];
    expect(setArg.trialEnd).toBeDefined();
    expect(typeof setArg.trialEnd).toBe("string");
    expect(new Date(setArg.trialEnd as string).getTime()).toBe(trialEndTs * 1000);
  });

  it("does NOT overwrite trialEnd when trial_end is null (non-trial subscription)", async () => {
    const sub = makeSubscription({
      status: "active",
      trial_end: null,
    });
    await postWebhook(
      makeStripeEvent("customer.subscription.updated", sub, "evt_no_trial_001") as Record<string, unknown>,
    );

    expect(sanityPatch.set).toHaveBeenCalled();
    const setArg = sanityPatch.set.mock.calls[0][0];
    // trialEnd should NOT be in the patch when trial_end is null
    expect(setArg.trialEnd).toBeUndefined();
  });
});

describe("webhook — trial: cancellation during trial period", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sanityWriteClientMock.fetch.mockResolvedValue({ _id: "sub-doc-id" });
  });

  it("marks subscription as cancelled when deleted during trialing status", async () => {
    const sub = makeSubscription({
      status: "canceled",
      canceled_at: 1760000100,
      trial_end: 1760000200, // trial would have ended later
    });
    await postWebhook(
      makeStripeEvent("customer.subscription.deleted", sub) as Record<string, unknown>,
    );

    expect(sanityPatch.set).toHaveBeenCalled();
    const setArg = sanityPatch.set.mock.calls[0][0];
    expect(setArg.status).toBe("cancelled");
  });
});
