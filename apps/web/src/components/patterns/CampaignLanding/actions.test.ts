/**
 * Free trial signup action tests.
 *
 * After the Founder-approved platform trial policy (Sep 2026):
 * - submitFreeTrialSignup provisions a real Sanity trial record (no card).
 * - registerPlatformTrial is the primary provisioning call.
 * - emailStandInPlatformClient.startTrial is a best-effort operator
 *   notification — success is not gated on it.
 *
 * Covers:
 * - Card-free registration (no Stripe interaction)
 * - Valid submission provisions trial via registerPlatformTrial
 * - Already-registered email returns a user-friendly error
 * - Sanity unavailable returns error (trial NOT started)
 * - Invalid email rejected without calling registerPlatformTrial
 * - Required fields rejected
 * - Required consent checkboxes rejected
 * - Optional marketing consent handled correctly
 * - Campaign/source attribution forwarded to operator notification
 * - Honeypot field silently succeeds without provisioning
 * - Cookie set on successful trial registration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StartTrialRequest, StartTrialResult } from "@/lib/platform/contract";
import type { RegisterTrialResult } from "@/lib/trialRegistration";

// ── Mocks ────────────────────────────────────────────────────────────────

let currentIp = "203.0.113.10";
const cookieSetMock = vi.fn();

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => (name === "x-forwarded-for" ? currentIp : null),
  }),
  cookies: async () => ({
    set: cookieSetMock,
    get: vi.fn(),
  }),
}));

const startTrialMock = vi.fn<
  (request: StartTrialRequest) => Promise<StartTrialResult>
>(async () => ({ status: "pending-manual-follow-up", message: "ok" }));

vi.mock("@/lib/platform/contract", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/platform/contract")>();
  return {
    ...actual,
    emailStandInPlatformClient: { startTrial: startTrialMock },
  };
});

// Platform trial registration — default: succeeds with a correlationRef
const registerPlatformTrialMock = vi.fn<
  (...args: unknown[]) => Promise<RegisterTrialResult>
>(async () => ({
  success: true,
  record: {
    correlationRef: "test-correlation-ref-uuid",
    trialStartedAt: new Date().toISOString(),
    trialExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
}));

vi.mock("@/lib/trialRegistration", () => ({
  registerPlatformTrial: registerPlatformTrialMock,
}));

// ── Imports ───────────────────────────────────────────────────────────────

const { submitFreeTrialSignup } = await import("./actions");
const { initialFreeTrialSignupState } = await import("./state");

// ── Helpers ───────────────────────────────────────────────────────────────

let ipCounter = 0;
function buildFormData(overrides: Record<string, string> = {}) {
  ipCounter += 1;
  currentIp = `203.0.113.${ipCounter}`;

  const fd = new FormData();
  const base: Record<string, string> = {
    campaign: "free30",
    source: "qa-test",
    firstName: "Qa",
    lastName: "Tester",
    email: "qa-tester@example.invalid",
    adultConfirmed: "on",
    guardianConfirmed: "on",
    legalAccepted: "on",
    ...overrides,
  };
  for (const [k, v] of Object.entries(base)) {
    if (v) fd.set(k, v);
  }
  return fd;
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("submitFreeTrialSignup — card-free trial registration", () => {
  beforeEach(() => {
    registerPlatformTrialMock.mockClear();
    startTrialMock.mockClear();
    cookieSetMock.mockClear();
  });

  it("succeeds without any Stripe interaction (no card required)", async () => {
    const fd = buildFormData();
    const result = await submitFreeTrialSignup(initialFreeTrialSignupState, fd);

    expect(result.status).toBe("success");
    // registerPlatformTrial is the provisioning call, not any Stripe API
    expect(registerPlatformTrialMock).toHaveBeenCalledTimes(1);
  });

  it("provisions trial via registerPlatformTrial on valid submission", async () => {
    const fd = buildFormData({ email: "parent@family.example" });
    await submitFreeTrialSignup(initialFreeTrialSignupState, fd);

    expect(registerPlatformTrialMock).toHaveBeenCalledTimes(1);
    const [email] = registerPlatformTrialMock.mock.calls[0];
    expect(email).toBe("parent@family.example");
  });

  it("sets the mtm_sub_ref cookie after successful registration", async () => {
    const fd = buildFormData();
    const result = await submitFreeTrialSignup(initialFreeTrialSignupState, fd);

    expect(result.status).toBe("success");
    expect(cookieSetMock).toHaveBeenCalledWith(
      "mtm_sub_ref",
      "test-correlation-ref-uuid",
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it("passes campaign and acquisitionSource to registerPlatformTrial", async () => {
    const fd = buildFormData({ campaign: "free30", source: "poster-blackpool" });
    await submitFreeTrialSignup(initialFreeTrialSignupState, fd);

    const [, options] = registerPlatformTrialMock.mock.calls[0];
    expect((options as { campaignId?: string }).campaignId).toBe("free30");
    expect((options as { acquisitionSource?: string }).acquisitionSource).toBe("poster-blackpool");
  });

  it("still sends operator notification email on success", async () => {
    const fd = buildFormData();
    await submitFreeTrialSignup(initialFreeTrialSignupState, fd);

    expect(startTrialMock).toHaveBeenCalledTimes(1);
    const arg = startTrialMock.mock.calls[0][0];
    expect(arg.offer).toEqual({ offerType: "free-trial", trialLengthDays: 30 });
  });
});

describe("submitFreeTrialSignup — already registered", () => {
  beforeEach(() => {
    registerPlatformTrialMock.mockClear();
    startTrialMock.mockClear();
    cookieSetMock.mockClear();
  });

  it("returns error when email already has an active trial (already_registered)", async () => {
    registerPlatformTrialMock.mockResolvedValueOnce({
      success: false,
      reason: "already_registered",
    });

    const fd = buildFormData({ email: "repeat@example.com" });
    const result = await submitFreeTrialSignup(initialFreeTrialSignupState, fd);

    expect(result.status).toBe("error");
    expect(result.message).toContain("trial");
  });

  it("does NOT set cookie when already_registered", async () => {
    registerPlatformTrialMock.mockResolvedValueOnce({
      success: false,
      reason: "already_registered",
    });

    const fd = buildFormData();
    await submitFreeTrialSignup(initialFreeTrialSignupState, fd);

    expect(cookieSetMock).not.toHaveBeenCalled();
  });
});

describe("submitFreeTrialSignup — Sanity unavailable", () => {
  beforeEach(() => {
    registerPlatformTrialMock.mockClear();
    startTrialMock.mockClear();
    cookieSetMock.mockClear();
  });

  it("returns error when Sanity is unavailable (sanity_unavailable)", async () => {
    registerPlatformTrialMock.mockResolvedValueOnce({
      success: false,
      reason: "sanity_unavailable",
    });

    const fd = buildFormData();
    const result = await submitFreeTrialSignup(initialFreeTrialSignupState, fd);

    expect(result.status).toBe("error");
    expect(result.message).toBeTruthy();
  });

  it("does NOT set cookie when Sanity is unavailable", async () => {
    registerPlatformTrialMock.mockResolvedValueOnce({
      success: false,
      reason: "sanity_unavailable",
    });

    const fd = buildFormData();
    await submitFreeTrialSignup(initialFreeTrialSignupState, fd);

    expect(cookieSetMock).not.toHaveBeenCalled();
  });
});

describe("submitFreeTrialSignup — validation", () => {
  beforeEach(() => {
    registerPlatformTrialMock.mockClear();
    startTrialMock.mockClear();
    cookieSetMock.mockClear();
  });

  it("rejects an invalid email without calling registerPlatformTrial", async () => {
    const fd = buildFormData({ email: "not-an-email" });
    const result = await submitFreeTrialSignup(initialFreeTrialSignupState, fd);

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.email).toBeTruthy();
    expect(registerPlatformTrialMock).not.toHaveBeenCalled();
  });

  it("rejects missing required fields (first/last name)", async () => {
    const fd = buildFormData({ firstName: "", lastName: "" });
    const result = await submitFreeTrialSignup(initialFreeTrialSignupState, fd);

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.firstName).toBeTruthy();
    expect(result.fieldErrors?.lastName).toBeTruthy();
    expect(registerPlatformTrialMock).not.toHaveBeenCalled();
  });

  it("rejects submission when a required consent checkbox is unchecked", async () => {
    const fd = buildFormData({ legalAccepted: "" });
    const result = await submitFreeTrialSignup(initialFreeTrialSignupState, fd);

    expect(result.status).toBe("error");
    expect(result.consentErrors?.legalAccepted).toBeTruthy();
    expect(registerPlatformTrialMock).not.toHaveBeenCalled();
  });

  it("keeps marketing consent optional and separate from the required checkboxes", async () => {
    const fd = buildFormData({});
    const result = await submitFreeTrialSignup(initialFreeTrialSignupState, fd);

    expect(result.status).toBe("success");
    const arg = startTrialMock.mock.calls[0][0];
    expect(arg.consent.marketingConsent).toBe(false);
  });

  it("carries the campaign/source fields through as attribution in operator notification", async () => {
    const fd = buildFormData({
      campaign: "free30",
      source: "poster-blackpool",
    });
    await submitFreeTrialSignup(initialFreeTrialSignupState, fd);

    expect(startTrialMock).toHaveBeenCalledTimes(1);
    const arg = startTrialMock.mock.calls[0][0];
    expect(arg.campaignId).toBe("free30");
    expect(arg.acquisitionSource).toBe("poster-blackpool");
  });

  it("reports success without provisioning when the honeypot field is filled", async () => {
    const fd = buildFormData({ company: "I am a bot" });
    const result = await submitFreeTrialSignup(initialFreeTrialSignupState, fd);

    expect(result.status).toBe("success");
    expect(registerPlatformTrialMock).not.toHaveBeenCalled();
    expect(cookieSetMock).not.toHaveBeenCalled();
  });
});
