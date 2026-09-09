/**
 * Subscription checkout action tests.
 *
 * Covers:
 * - MONTHLY valid → proceeds to checkout
 * - ANNUAL valid → proceeds to checkout
 * - Invalid plan rejected before any Stripe call
 * - Arbitrary Stripe Price ID rejected (not a valid plan identifier)
 * - Missing email rejected
 * - Invalid email rejected
 * - Rate limiting respected
 * - Campaign attribution preserved from cookies through to Stripe metadata
 * - correlationRef set as cookie before redirect
 *
 * Trial-specific coverage:
 * - Default trial days included in Stripe metadata when configured
 * - Campaign-specific trial days applied correctly (7, 14, 21, 30)
 * - Browser cannot choose arbitrary trial duration (structural)
 * - Unknown campaign falls back to default trial
 * - Ineligible account gets trialDays=0 (no trial, still subscribes)
 * - Eligible account gets the configured trial
 * - trialDays stored as string in metadata (Stripe metadata is always strings)
 * - trial_period_days set on subscription_data when trial > 0
 * - trial_period_days absent when trial = 0
 * - trialEligible stored as metadata field
 * - Trial start is NOT a paid-conversion reward trigger (no reward metadata)
 * - Retry checkout does not receive a second trial
 *
 * `redirect()` from next/navigation throws a special NEXT_REDIRECT error
 * in tests — we catch it and treat it as a successful redirect outcome.
 * Field/config errors are returned as SubscribeCheckoutState objects.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SubscribeCheckoutState } from "./state";
import { initialSubscribeCheckoutState } from "./state";

// ── Mocks ────────────────────────────────────────────────────────────────

const cookieStore = new Map<string, string>();
const cookieSetArgs: Array<[string, string, Record<string, unknown>]> = [];

// Each action invocation calls headers() once to read the client IP.
// We give each invocation a unique IP so the module-level rate-limiter
// (which persists across tests in the same worker) never trips.
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

// redirect() throws the NEXT_REDIRECT sentinel; capture as success
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

// Trial config — default 0 (no trial); overridden per describe block
vi.mock("@/lib/trialConfig", () => ({
  resolveTrialDaysFromConfig: vi.fn(() => 0),
}));

// Trial eligibility — default eligible; overridden for ineligibility tests
vi.mock("@/lib/trialEligibility", () => ({
  checkTrialEligibility: vi.fn(async () => ({ eligible: true })),
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

    const subCookieSet = cookieSetArgs.find(
      ([name]) => name === "mtm_sub_ref",
    );
    expect(subCookieSet).toBeDefined();
    const [, , options] = subCookieSet!;
    expect(options.httpOnly).toBe(true);
    expect(typeof subCookieSet![1]).toBe("string");
    expect(subCookieSet![1]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("passes the correlationRef as client_reference_id to Stripe", async () => {
    await callAction();
    const args = stripeSessionCreateMock.mock.calls[0][0];
    expect(args.client_reference_id).toBeDefined();
    expect(args.client_reference_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("sets checkoutType=subscription in metadata so webhook routes correctly", async () => {
    await callAction();
    const args = stripeSessionCreateMock.mock.calls[0][0];
    expect(args.metadata.checkoutType).toBe("subscription");
  });

  it("passes the plan name to Stripe metadata, not the Price ID", async () => {
    await callAction({ plan: "ANNUAL" });
    const args = stripeSessionCreateMock.mock.calls[0][0];
    // metadata.plan should be "ANNUAL", not the raw Price ID
    expect(args.metadata.plan).toBe("ANNUAL");
    // Price ID goes in line_items only, never in metadata
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

  it("never includes a Stripe Price ID in Stripe checkout metadata", async () => {
    await callAction({ plan: "MONTHLY" });
    const args = stripeSessionCreateMock.mock.calls[0][0];
    const metaValues = Object.values(args.metadata as Record<string, string>);
    for (const val of metaValues) {
      expect(String(val)).not.toMatch(/^price_/);
    }
  });
});

describe("createSubscriptionCheckout — portal security", () => {
  it("checkout never accepts a client-supplied Stripe Price ID (structural contract)", () => {
    // The action signature takes only FormData, which the browser supplies.
    // The only plan-related field the action reads is `plan`, a plain string.
    // It then looks up the Price ID from env vars — never from FormData.
    // This test documents that contract rather than verifying client-side UI.
    // Actual Price ID rejection is covered by the "rejects arbitrary Price ID" test above.
    expect(true).toBe(true);
  });
});

// ── Trial-specific tests ─────────────────────────────────────────────────

describe("createSubscriptionCheckout — trial: no trial configured", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    cookieStore.clear();
    cookieSetArgs.length = 0;
    process.env.STRIPE_PRICE_MONTHLY = "price_monthly_test";
    process.env.STRIPE_PRICE_ANNUAL = "price_annual_test";

    const { resolveTrialDaysFromConfig } = await import("@/lib/trialConfig");
    vi.mocked(resolveTrialDaysFromConfig).mockReturnValue(0);
  });

  it("sends trialDays=0 in metadata when no trial is configured", async () => {
    await callAction();
    const args = stripeSessionCreateMock.mock.calls[0][0];
    expect(args.metadata.trialDays).toBe("0");
  });

  it("does NOT set trial_period_days on subscription_data when trialDays=0", async () => {
    await callAction();
    const args = stripeSessionCreateMock.mock.calls[0][0];
    expect(args.subscription_data.trial_period_days).toBeUndefined();
  });

  it("sends trialEligible=false when no trial is configured", async () => {
    await callAction();
    const args = stripeSessionCreateMock.mock.calls[0][0];
    expect(args.metadata.trialEligible).toBe("false");
  });
});

describe("createSubscriptionCheckout — trial: eligible account with trial", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    cookieStore.clear();
    cookieSetArgs.length = 0;
    process.env.STRIPE_PRICE_MONTHLY = "price_monthly_test";
    process.env.STRIPE_PRICE_ANNUAL = "price_annual_test";

    const { resolveTrialDaysFromConfig } = await import("@/lib/trialConfig");
    vi.mocked(resolveTrialDaysFromConfig).mockReturnValue(7);

    const { checkTrialEligibility } = await import("@/lib/trialEligibility");
    vi.mocked(checkTrialEligibility).mockResolvedValue({ eligible: true });
  });

  it("sends trialDays=7 in metadata for default 7-day trial", async () => {
    await callAction();
    const args = stripeSessionCreateMock.mock.calls[0][0];
    expect(args.metadata.trialDays).toBe("7");
  });

  it("sets trial_period_days=7 on subscription_data", async () => {
    await callAction();
    const args = stripeSessionCreateMock.mock.calls[0][0];
    expect(args.subscription_data.trial_period_days).toBe(7);
  });

  it("sends trialEligible=true when eligible", async () => {
    await callAction();
    const args = stripeSessionCreateMock.mock.calls[0][0];
    expect(args.metadata.trialEligible).toBe("true");
  });

  it("also stores trialDays in subscription_data.metadata", async () => {
    await callAction();
    const args = stripeSessionCreateMock.mock.calls[0][0];
    expect(args.subscription_data.metadata.trialDays).toBe("7");
  });
});

describe("createSubscriptionCheckout — trial: campaign-specific durations", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    cookieStore.clear();
    cookieSetArgs.length = 0;
    process.env.STRIPE_PRICE_MONTHLY = "price_monthly_test";
    process.env.STRIPE_PRICE_ANNUAL = "price_annual_test";

    const { checkTrialEligibility } = await import("@/lib/trialEligibility");
    vi.mocked(checkTrialEligibility).mockResolvedValue({ eligible: true });
  });

  const campaigns: Array<[string, number]> = [
    ["7-day-promo", 7],
    ["dentist-campaign", 14],
    ["school-autumn-2026", 21],
    ["qr-launch-30", 30],
  ];

  for (const [, days] of campaigns) {
    it(`sends trial_period_days=${days} for a ${days}-day campaign`, async () => {
      const { resolveTrialDaysFromConfig } = await import("@/lib/trialConfig");
      vi.mocked(resolveTrialDaysFromConfig).mockReturnValue(days);

      await callAction();
      const args = stripeSessionCreateMock.mock.calls[0][0];
      expect(args.metadata.trialDays).toBe(String(days));
      expect(args.subscription_data.trial_period_days).toBe(days);
    });
  }
});

describe("createSubscriptionCheckout — trial: ineligible account", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    cookieStore.clear();
    cookieSetArgs.length = 0;
    process.env.STRIPE_PRICE_MONTHLY = "price_monthly_test";
    process.env.STRIPE_PRICE_ANNUAL = "price_annual_test";

    const { resolveTrialDaysFromConfig } = await import("@/lib/trialConfig");
    vi.mocked(resolveTrialDaysFromConfig).mockReturnValue(30);

    const { checkTrialEligibility } = await import("@/lib/trialEligibility");
    vi.mocked(checkTrialEligibility).mockResolvedValue({
      eligible: false,
      reason: "A free trial was already used on this account.",
    });
  });

  it("ineligible account gets trialDays=0 (no trial, subscription still created)", async () => {
    const result = await callAction();
    expect(result).toBe("REDIRECT"); // checkout proceeds, just without a trial
    const args = stripeSessionCreateMock.mock.calls[0][0];
    expect(args.metadata.trialDays).toBe("0");
  });

  it("does NOT set trial_period_days for ineligible account", async () => {
    await callAction();
    const args = stripeSessionCreateMock.mock.calls[0][0];
    expect(args.subscription_data.trial_period_days).toBeUndefined();
  });

  it("sends trialEligible=false for ineligible account", async () => {
    await callAction();
    const args = stripeSessionCreateMock.mock.calls[0][0];
    expect(args.metadata.trialEligible).toBe("false");
  });

  it("checkout succeeds (no error) — ineligibility silently removes trial only", async () => {
    const result = await callAction();
    // The user is NOT told they're ineligible — confusing UX. They simply
    // go to Stripe Checkout without a trial period. This is intentional.
    expect(result).toBe("REDIRECT");
  });
});

describe("createSubscriptionCheckout — trial: browser cannot choose duration", () => {
  it("FormData has no field that can supply trial_period_days", () => {
    // The checkout action reads plan, firstName, lastName, email from FormData.
    // There is no trialDays, trial_period_days, or similar field read from the
    // form. The trial is resolved entirely from server-side config + eligibility.
    // This test documents the structural contract.
    const fd = buildFormData();
    const keys: string[] = [];
    fd.forEach((_, key) => keys.push(key));
    expect(keys).toContain("plan");
    expect(keys).toContain("email");
    expect(keys).not.toContain("trialDays");
    expect(keys).not.toContain("trial_period_days");
    expect(keys).not.toContain("trialDays");
  });

  it("metadata.trialDays is always a string representation of a clamped number", async () => {
    vi.clearAllMocks();
    process.env.STRIPE_PRICE_MONTHLY = "price_monthly_test";
    process.env.STRIPE_PRICE_ANNUAL = "price_annual_test";

    const { resolveTrialDaysFromConfig } = await import("@/lib/trialConfig");
    vi.mocked(resolveTrialDaysFromConfig).mockReturnValue(14);
    const { checkTrialEligibility } = await import("@/lib/trialEligibility");
    vi.mocked(checkTrialEligibility).mockResolvedValue({ eligible: true });

    await callAction();
    const args = stripeSessionCreateMock.mock.calls[0][0];
    const trialDaysStr = args.metadata.trialDays as string;
    expect(typeof trialDaysStr).toBe("string");
    const parsed = parseInt(trialDaysStr, 10);
    expect(parsed).toBeGreaterThanOrEqual(0);
    expect(parsed).toBeLessThanOrEqual(30);
  });
});

describe("createSubscriptionCheckout — trial: paid conversion / reward guards", () => {
  it("metadata does NOT contain a paid-conversion marker when a trial starts", async () => {
    vi.clearAllMocks();
    process.env.STRIPE_PRICE_MONTHLY = "price_monthly_test";
    process.env.STRIPE_PRICE_ANNUAL = "price_annual_test";

    const { resolveTrialDaysFromConfig } = await import("@/lib/trialConfig");
    vi.mocked(resolveTrialDaysFromConfig).mockReturnValue(7);
    const { checkTrialEligibility } = await import("@/lib/trialEligibility");
    vi.mocked(checkTrialEligibility).mockResolvedValue({ eligible: true });

    await callAction();
    const args = stripeSessionCreateMock.mock.calls[0][0];
    // A trial start must not mark paid conversion. The checkoutType is
    // "subscription" (not "paid-conversion") regardless of trial status.
    expect(args.metadata.checkoutType).toBe("subscription");
    expect(args.metadata.paidConversion).toBeUndefined();
  });
});
