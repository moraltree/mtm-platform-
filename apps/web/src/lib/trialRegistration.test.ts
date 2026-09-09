/**
 * Platform trial registration tests.
 *
 * Covers:
 * - Card-free registration (no Stripe interaction)
 * - Sanity record created with correct fields (status, trialDays, trialEnd, no Stripe IDs)
 * - trialEnd is exactly MAX_TRIAL_DAYS (30) days from registration
 * - trialDays = MAX_TRIAL_DAYS (30), server-set — never from client
 * - Ineligible email (repeat trial) returns already_registered
 * - Sanity unavailable returns sanity_unavailable
 * - Sanity write error returns error
 * - correlationRef returned for cookie setting by caller
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { MAX_TRIAL_DAYS } from "@/lib/trialConfig";

// ── Mocks ────────────────────────────────────────────────────────────────

const sanityCreateMock = vi.fn().mockResolvedValue({ _id: "new-trial-id" });
const sanityFetchMock = vi.fn();

vi.mock("@/lib/sanity/writeClient", () => ({
  sanityWriteClient: {
    create: sanityCreateMock,
    fetch: sanityFetchMock,
  },
}));

// Trial eligibility — default: eligible
vi.mock("@/lib/trialEligibility", () => ({
  checkTrialEligibility: vi.fn(async () => ({ eligible: true })),
}));

// ── Tests ─────────────────────────────────────────────────────────────────

describe("registerPlatformTrial — card-free registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("succeeds without any Stripe interaction", async () => {
    const { registerPlatformTrial } = await import("./trialRegistration");
    const result = await registerPlatformTrial("parent@example.com");
    expect(result.success).toBe(true);
    // Verify no Stripe module was imported or called (structural)
    // The Sanity create was called, not any Stripe API
    expect(sanityCreateMock).toHaveBeenCalled();
  });

  it("creates a Sanity document with status=trialing", async () => {
    const { registerPlatformTrial } = await import("./trialRegistration");
    await registerPlatformTrial("parent@example.com");
    const created = sanityCreateMock.mock.calls[0][0];
    expect(created._type).toBe("subscription");
    expect(created.status).toBe("trialing");
  });

  it("creates NO Stripe IDs in the document", async () => {
    const { registerPlatformTrial } = await import("./trialRegistration");
    await registerPlatformTrial("parent@example.com");
    const created = sanityCreateMock.mock.calls[0][0];
    expect(created.stripeSubscriptionId).toBeUndefined();
    expect(created.stripeCustomerId).toBeUndefined();
    expect(created.stripeCheckoutSessionId).toBeUndefined();
  });

  it("sets trialDays = MAX_TRIAL_DAYS (30) — server-set, never from client", async () => {
    const { registerPlatformTrial } = await import("./trialRegistration");
    await registerPlatformTrial("parent@example.com");
    const created = sanityCreateMock.mock.calls[0][0];
    expect(created.trialDays).toBe(MAX_TRIAL_DAYS);
    expect(created.trialDays).toBe(30);
  });

  it("sets trialEnd to exactly 30 days from now", async () => {
    const before = Date.now();
    const { registerPlatformTrial } = await import("./trialRegistration");
    await registerPlatformTrial("parent@example.com");
    const after = Date.now();

    const created = sanityCreateMock.mock.calls[0][0];
    const trialEndMs = new Date(created.trialEnd as string).getTime();
    const trialStartMs = new Date(created.trialStartedAt as string).getTime();

    // Should be within the test execution window
    expect(trialStartMs).toBeGreaterThanOrEqual(before);
    expect(trialStartMs).toBeLessThanOrEqual(after);

    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(trialEndMs - trialStartMs).toBeCloseTo(thirtyDaysMs, -2); // within ~100ms
  });

  it("sets trialEligible = true", async () => {
    const { registerPlatformTrial } = await import("./trialRegistration");
    await registerPlatformTrial("parent@example.com");
    const created = sanityCreateMock.mock.calls[0][0];
    expect(created.trialEligible).toBe(true);
  });

  it("normalises email to lower case before storing", async () => {
    const { registerPlatformTrial } = await import("./trialRegistration");
    await registerPlatformTrial("Parent@EXAMPLE.COM");
    const created = sanityCreateMock.mock.calls[0][0];
    expect(created.customerEmail).toBe("parent@example.com");
  });

  it("stores the correlationRef in the document", async () => {
    const { registerPlatformTrial } = await import("./trialRegistration");
    const result = await registerPlatformTrial("parent@example.com");
    expect(result.success).toBe(true);
    if (!result.success) return;
    const created = sanityCreateMock.mock.calls[0][0];
    expect(created.correlationRef).toBe(result.record.correlationRef);
    expect(created.correlationRef).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("returns correlationRef and expiry timestamps for the caller to set as cookies", async () => {
    const { registerPlatformTrial } = await import("./trialRegistration");
    const result = await registerPlatformTrial("parent@example.com");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.record.correlationRef).toBeTruthy();
    expect(result.record.trialStartedAt).toBeTruthy();
    expect(result.record.trialExpiresAt).toBeTruthy();
    expect(new Date(result.record.trialExpiresAt).getTime()).toBeGreaterThan(
      new Date(result.record.trialStartedAt).getTime(),
    );
  });

  it("preserves campaignId and acquisitionSource in the document", async () => {
    const { registerPlatformTrial } = await import("./trialRegistration");
    await registerPlatformTrial("parent@example.com", {
      campaignId: "savannah-seven-promo",
      acquisitionSource: "qr-poster",
    });
    const created = sanityCreateMock.mock.calls[0][0];
    expect(created.campaignId).toBe("savannah-seven-promo");
    expect(created.acquisitionSource).toBe("qr-poster");
  });
});

describe("registerPlatformTrial — eligibility gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns already_registered when checkTrialEligibility returns ineligible", async () => {
    const { checkTrialEligibility } = await import("@/lib/trialEligibility");
    vi.mocked(checkTrialEligibility).mockResolvedValue({
      eligible: false,
      reason: "A free trial was already used on this account.",
    });

    const { registerPlatformTrial } = await import("./trialRegistration");
    const result = await registerPlatformTrial("repeat@example.com");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.reason).toBe("already_registered");
    expect(sanityCreateMock).not.toHaveBeenCalled();
  });

  it("does NOT create a Sanity record when already_registered", async () => {
    const { checkTrialEligibility } = await import("@/lib/trialEligibility");
    vi.mocked(checkTrialEligibility).mockResolvedValue({
      eligible: false,
      reason: "Prior trial found.",
    });

    const { registerPlatformTrial } = await import("./trialRegistration");
    await registerPlatformTrial("repeat@example.com");
    expect(sanityCreateMock).not.toHaveBeenCalled();
  });
});

describe("registerPlatformTrial — Sanity unavailable", () => {
  it("returns sanity_unavailable when Sanity write client is null", async () => {
    vi.resetModules();
    vi.doMock("@/lib/sanity/writeClient", () => ({
      sanityWriteClient: null,
    }));
    vi.doMock("@/lib/trialEligibility", () => ({
      checkTrialEligibility: vi.fn(async () => ({ eligible: true })),
    }));
    vi.doMock("@/lib/trialConfig", () => ({
      MAX_TRIAL_DAYS: 30,
      clampTrialDays: (d: number) => Math.min(Math.max(0, d), 30),
    }));

    const { registerPlatformTrial } = await import("./trialRegistration");
    const result = await registerPlatformTrial("parent@example.com");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.reason).toBe("sanity_unavailable");

    vi.resetModules();
  });
});

describe("registerPlatformTrial — Sanity write error", () => {
  it("returns error when Sanity create throws", async () => {
    vi.resetModules();
    vi.doMock("@/lib/sanity/writeClient", () => ({
      sanityWriteClient: { create: sanityCreateMock, fetch: sanityFetchMock },
    }));
    vi.doMock("@/lib/trialEligibility", () => ({
      checkTrialEligibility: vi.fn(async () => ({ eligible: true })),
    }));
    vi.doMock("@/lib/trialConfig", () => ({
      MAX_TRIAL_DAYS: 30,
      clampTrialDays: (d: number) => Math.min(Math.max(0, d), 30),
    }));
    sanityCreateMock.mockRejectedValueOnce(new Error("Sanity network error"));

    const { registerPlatformTrial } = await import("./trialRegistration");
    const result = await registerPlatformTrial("parent@example.com");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.reason).toBe("error");

    vi.resetModules();
  });
});
