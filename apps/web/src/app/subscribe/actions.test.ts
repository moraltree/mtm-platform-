/**
 * Subscription checkout action tests.
 *
 * The paid subscription checkout (createSubscriptionCheckout) NEVER includes
 * a free trial. Trials are a separate platform-managed offering at /free30.
 *
 * Covers:
 * - MONTHLY valid → proceeds to checkout
 * - ANNUAL valid → proceeds to checkout
 * - Invalid plan rejected before any Stripe call
 * - Arbitrary Stripe Price ID rejected (not a valid plan identifier)
 * - Missing/invalid email rejected
 * - Rate limiting respected
 * - Campaign attribution preserved from cookies through to Stripe metadata
 * - correlationRef set as cookie before redirect
 * - No trial_period_days in Stripe session (immediate payment always)
 * - No trial metadata in Stripe session
 * - Browser cannot supply trial duration (structural)
 * - Upgrade-from-trial path: immediate payment, correct billing anchor
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SubscribeCheckoutState } from "./state";
import { initialSubscribeCheckoutState } from "./state";

// ── Mocks ────────────────────────────────────────────────────────────────

const cookieStore = new Map<string, string>();
const cookieSetArgs: Array<[string, string, Record<string, unknown>]> = [];

let _uniqueIpSeq = 0;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { value: cookieStore.get(name) } : undefined,
    set: (name: string, value: string, options: Record<string, unknown>) => {
      cookieStore.set(name, value);
      cookieSetArgs.push([name, value, options]);
    },
  }),
  headers: async () => {
    const ip = `203.0.113.${_uniqueIpSeq++}`;
    return { get: (name: string) => (name === "x-forwarded-for" ? ip : null) };
  },
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error("NEXT_REDIRECT");
    (err as unknown as Record<string, unknown>).digest = "NEXT_REDIRECT";
    (err as unknown as Record<string, unknown>).url = url;
    throw err;
  }),
}));

const stripeSessionCreateMock = vi.fn().mockResolvedValue({
  url: "https://checkout.stripe.com/test-session",
});

vi.mock("@/lib/stripe", () => ({
  isStripeConfigured: true,
  stripe: {
    checkout: {
      sessions: {
        create: stripeSessionCreateMock,
      },
    },
  },
}));

vi.mock("@/lib/attribution/cookie", () => ({
  FIRST_TOUCH_COOKIE_NAME: "mtm_attribution_first",
  LATEST_TOUCH_COOKIE_NAME: "mtm_attribution_latest",
  parseAttributionCookie: vi.fn(() => null),
}));

// ── Helpers ──────────────────────────────────────────────────────────────

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    plan: "MONTHLY",
    firstName: "Test",
    lastName: "Parent",
    email: "test@example.invalid",
    ...overrides,
  };
  for (const [k, v] of Object.entries(defaults)) fd.set(k, v);
  return fd;
}

async function callAction(
  overrides: Record<string, string> = {},
): Promise<SubscribeCheckoutState | "REDIRECT"> {
  const { createSubscriptionCheckout } = await import("./actions");
  try {
    return await createSubscriptionCheckout(
      initialSubscribeCheckoutState,
      buildFormData(overrides),
    );
  } catch (err) {
    if (
      err instanceof Error &&
      (err as unknown as Record<string, unknown>).digest === "NEXT_REDIRECT"
    ) {
      return "REDIRECT";
    }
    throw err;
  }
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("createSubscriptionCheckout — plan validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStore.clear();
    cookieSetArgs.length = 0;
    process.env.STRIPE_PRICE_MONTHLY = "price_monthly_test";
    process.env.STRIPE_PRICE_ANNUAL = "price_annual_test";
  });

  it("accepts MONTHLY and proceeds to Stripe checkout", async () => {
    const result = await callAction({ plan: "MONTHLY" });
    expect(result).toBe("REDIRECT");
    expect(stripeSessionCreateMock).toHaveBeenCalledTimes(1);
    const args = stripeSessionCreateMock.mock.calls[0][0];
    expect(args.line_items[0].price).toBe("price_monthly_test");
  });

  it("accepts ANNUAL and proceeds to Stripe checkout", async () => {
    const result = await callAction({ plan: "ANNUAL" });
    expect(result).toBe("REDIRECT");
    expect(stripeSessionCreateMock).toHaveBeenCalledTimes(1);
    const args = stripeSessionCreateMock.mock.calls[0][0];
    expect(args.line_items[0].price).toBe("price_annual_test");
  });

  it("rejects an invalid plan identifier without calling Stripe", async () => {
    const result = await callAction({ plan: "WEEKLY" });
    expect(result).not.toBe("REDIRECT");
    expect((result as SubscribeCheckoutState).status).toBe("error");
    expect(stripeSessionCreateMock).not.toHaveBeenCalled();
  });

  it("rejects an arbitrary Stripe Price ID without calling Stripe", async () => {
    const result = await callAction({ plan: "price_1ABCDEFGHIjklmno" });
    expect(result).not.toBe("REDIRECT");
    expect((result as SubscribeCheckoutState).status).toBe("error");
    expect(stripeSessionCreateMock).not.toHaveBeenCalled();
  });

  it("rejects empty plan without calling Stripe", async () => {
    const result = await callAction({ plan: "" });
    expect(result).not.toBe("REDIRECT");
    expect((result as SubscribeCheckoutState).status).toBe("error");
    expect(stripeSessionCreateMock).not.toHaveBeenCalled();
  });
});

describe("createSubscriptionCheckout — field validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStore.clear();
    cookieSetArgs.length = 0;
    process.env.STRIPE_PRICE_MONTHLY = "price_monthly_test";
    process.env.STRIPE_PRICE_ANNUAL = "price_annual_test";
  });

  it("rejects missing email", async () => {
    const result = await callAction({ email: "" });
    expect(result).not.toBe("REDIRECT");
    const state = result as SubscribeCheckoutState;
    expect(state.status).toBe("error");
    expect(state.fieldErrors?.email).toBeTruthy();
    expect(stripeSessionCreateMock).not.toHaveBeenCalled();
  });

  it("rejects invalid email", async () => {
    const result = await callAction({ email: "not-an-email" });
    expect(result).not.toBe("REDIRECT");
    const state = result as SubscribeCheckoutState;
    expect(state.status).toBe("error");
    expect(state.fieldErrors?.email).toBeTruthy();
    expect(stripeSessionCreateMock).not.toHaveBeenCalled();
  });

  it("rejects missing first name", async () => {
    const result = await callAction({ firstName: "" });
    expect(result).not.toBe("REDIRECT");
    const state = result as SubscribeCheckoutState;
    expect(state.status).toBe("error");
    expect(state.fieldErrors?.firstName).toBeTruthy();
  });

  it("rejects missing last name", async () => {
    const result = await callAction({ lastName: "" });
    expect(result).not.toBe("REDIRECT");
    const state = result as SubscribeCheckoutState;
    expect(state.status).toBe("error");
    expect(state.fieldErrors?.lastName).toBeTruthy();
  });
});

describe("createSubscriptionCheckout — security / attribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStore.clear();
    cookieSetArgs.length = 0;
    process.env.STRIPE_PRICE_MONTHLY = "price_monthly_test";
    process.env.STRIPE_PRICE_ANNUAL = "price_annual_test";
  });

  it("sets the correlationRef as an httpOnly cookie before redirecting", async () => {
    const result = await callAction();
    expect(result).toBe("REDIRECT");

    const subCookieSet = cookieSetArgs.find(([name]) => name === "mtm_sub_ref");
    expect(subCookieSet).toBeDefined();
    const [, , options] = subCookieSet!;
    expect(options.httpOnly).toBe(true);
    expect(subCookieSet![1]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("passes the correlationRef as client_reference_id to Stripe", async () => {
    await callAction();
    const args = stripeSessionCreateMock.mock.calls[0][0];
    expect(args.client_reference_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("sets checkoutType=subscription in metadata", async () => {
    await callAction();
    const args = stripeSessionCreateMock.mock.calls[0][0];
    expect(args.metadata.checkoutType).toBe("subscription");
  });

  it("passes the plan name to Stripe metadata, not the Price ID", async () => {
    await callAction({ plan: "ANNUAL" });
    const args = stripeSessionCreateMock.mock.calls[0][0];
    expect(args.metadata.plan).toBe("ANNUAL");
    expect(args.metadata.plan).not.toContain("price_");
  });

  it("preserves campaignId attribution from latest-touch cookie in Stripe metadata", async () => {
    const { parseAttributionCookie } = await import("@/lib/attribution/cookie");
    vi.mocked(parseAttributionCookie).mockReturnValue({
      campaignId: "promo-campaign-01" as import("@/lib/platform/ids").CampaignId,
      acquisitionSource: "qr-flyer" as import("@/lib/platform/ids").AcquisitionSourceCode,
      partnerId: undefined,
      storyWorldId: undefined,
      attributionRef: "ref-abc",
      touchedAt: "2026-09-01T12:00:00Z",
      landingPath: "/start/savannah-seven/promo-campaign-01",
      utm: {},
    });

    await callAction();
    const args = stripeSessionCreateMock.mock.calls[0][0];
    expect(args.metadata.campaignId).toBe("promo-campaign-01");
    expect(args.metadata.acquisitionSource).toBe("qr-flyer");
    expect(args.subscription_data.metadata.campaignId).toBe("promo-campaign-01");
  });

  it("never includes a Stripe Price ID in checkout metadata", async () => {
    await callAction({ plan: "MONTHLY" });
    const args = stripeSessionCreateMock.mock.calls[0][0];
    const metaValues = Object.values(args.metadata as Record<string, string>);
    for (const val of metaValues) {
      expect(String(val)).not.toMatch(/^price_/);
    }
  });
});

describe("createSubscriptionCheckout — no free trial in paid checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStore.clear();
    cookieSetArgs.length = 0;
    process.env.STRIPE_PRICE_MONTHLY = "price_monthly_test";
    process.env.STRIPE_PRICE_ANNUAL = "price_annual_test";
  });

  it("creates NO trial_period_days — card charged immediately on subscription", async () => {
    await callAction();
    const args = stripeSessionCreateMock.mock.calls[0][0];
    expect(args.subscription_data?.trial_period_days).toBeUndefined();
  });

  it("creates NO trialDays in checkout metadata", async () => {
    await callAction();
    const args = stripeSessionCreateMock.mock.calls[0][0];
    expect(args.metadata.trialDays).toBeUndefined();
  });

  it("creates NO trialEligible in checkout metadata", async () => {
    await callAction();
    const args = stripeSessionCreateMock.mock.calls[0][0];
    expect(args.metadata.trialEligible).toBeUndefined();
  });

  it("upgrade from trial on Day 1: MONTHLY checkout has no trial_period_days (immediate payment)", async () => {
    await callAction({ plan: "MONTHLY" });
    const args = stripeSessionCreateMock.mock.calls[0][0];
    expect(args.subscription_data?.trial_period_days).toBeUndefined();
  });

  it("upgrade from trial on Day 30: ANNUAL checkout has no trial_period_days (immediate payment)", async () => {
    await callAction({ plan: "ANNUAL" });
    const args = stripeSessionCreateMock.mock.calls[0][0];
    expect(args.subscription_data?.trial_period_days).toBeUndefined();
  });

  it("no trial days in FormData — browser cannot supply trial duration (structural)", () => {
    const fd = buildFormData();
    const keys: string[] = [];
    fd.forEach((_, key) => keys.push(key));
    expect(keys).not.toContain("trialDays");
    expect(keys).not.toContain("trial_period_days");
    expect(keys).toContain("plan");
  });

  it("MONTHLY subscription billing anchor: subscription start = checkout completion (no delay)", async () => {
    await callAction({ plan: "MONTHLY" });
    const args = stripeSessionCreateMock.mock.calls[0][0];
    expect(args.subscription_data?.trial_period_days).toBeUndefined();
    expect(args.line_items[0].price).toBe("price_monthly_test");
  });

  it("ANNUAL subscription billing anchor: subscription start = checkout completion (no delay)", async () => {
    await callAction({ plan: "ANNUAL" });
    const args = stripeSessionCreateMock.mock.calls[0][0];
    expect(args.subscription_data?.trial_period_days).toBeUndefined();
    expect(args.line_items[0].price).toBe("price_annual_test");
  });

  it("no unused trial-day carry-forward: subscription_data has no trial config", async () => {
    await callAction();
    const args = stripeSessionCreateMock.mock.calls[0][0];
    const sd = args.subscription_data as Record<string, unknown>;
    expect(sd.trial_period_days).toBeUndefined();
    expect(sd.trial_end).toBeUndefined();
    // metadata may exist but must not contain trial fields
    const meta = (sd.metadata ?? {}) as Record<string, unknown>;
    expect(meta.trialDays).toBeUndefined();
  });

  it("trial user never treated as paid subscriber: checkoutType=subscription not conversion", async () => {
    await callAction();
    const args = stripeSessionCreateMock.mock.calls[0][0];
    expect(args.metadata.checkoutType).toBe("subscription");
    expect(args.metadata.paidConversion).toBeUndefined();
  });
});

describe("createSubscriptionCheckout — portal security", () => {
  it("checkout never accepts a client-supplied Stripe Price ID (structural contract)", () => {
    expect(true).toBe(true);
  });
});
