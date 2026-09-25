import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  StartTrialRequest,
  StartTrialResult,
} from "@/lib/platform/contract";

/**
 * Regression coverage for `submitFreeTrialSignup` (the `/free30` action)
 * — previously untested (only its sibling `submitCampaignSignup`, for
 * `/start/[storyWorld]/[campaign]`, had a test file). Added as part of
 * the 24 Aug 2026 free-trial-registration refinement sprint's explicit
 * test list: invalid email, required fields, checkbox/consent
 * validation, successful submission, and campaign attribution
 * (`campaign`/`source` reaching `emailStandInPlatformClient.startTrial`
 * unchanged). Terms/Privacy link correctness and mobile/tablet layout
 * are visual/markup concerns, not covered by a Node-side unit test —
 * see the sprint report for how those were verified instead.
 *
 * Mocks `next/headers` (rate limiting's only dependency needing a real
 * request context) and `emailStandInPlatformClient.startTrial`, same
 * pattern as `start/[storyWorld]/[campaign]/actions.test.ts`.
 */

let currentIp = "203.0.113.10";

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => (name === "x-forwarded-for" ? currentIp : null),
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

const { submitFreeTrialSignup } = await import("./actions");
const { initialFreeTrialSignupState } = await import("./state");

let ipCounter = 0;
function buildFormData(overrides: Record<string, string> = {}) {
  // A fresh IP per test avoids the shared in-memory rate limiter
  // carrying state across otherwise-unrelated test cases.
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
  // A real unchecked HTML checkbox is *absent* from FormData, not
  // present with an empty value — see validate.ts#isChecked. An
  // override of "" (e.g. `legalAccepted: ""`) simulates that by
  // skipping the `.set()` call entirely, not setting an empty string.
  for (const [k, v] of Object.entries(base)) {
    if (v) fd.set(k, v);
  }
  return fd;
}

describe("submitFreeTrialSignup", () => {
  beforeEach(() => {
    startTrialMock.mockClear();
  });

  it("rejects an invalid email without calling startTrial", async () => {
    const fd = buildFormData({ email: "not-an-email" });
    const result = await submitFreeTrialSignup(initialFreeTrialSignupState, fd);

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.email).toBeTruthy();
    expect(startTrialMock).not.toHaveBeenCalled();
  });

  it("rejects missing required fields (first/last name)", async () => {
    const fd = buildFormData({ firstName: "", lastName: "" });
    const result = await submitFreeTrialSignup(initialFreeTrialSignupState, fd);

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.firstName).toBeTruthy();
    expect(result.fieldErrors?.lastName).toBeTruthy();
    expect(startTrialMock).not.toHaveBeenCalled();
  });

  it("rejects submission when a required consent checkbox is unchecked", async () => {
    const fd = buildFormData({ legalAccepted: "" });
    const result = await submitFreeTrialSignup(initialFreeTrialSignupState, fd);

    expect(result.status).toBe("error");
    expect(result.consentErrors?.legalAccepted).toBeTruthy();
    expect(startTrialMock).not.toHaveBeenCalled();
  });

  it("keeps marketing consent optional and separate from the required checkboxes", async () => {
    // marketingConsent deliberately omitted — should still succeed.
    const fd = buildFormData({});
    const result = await submitFreeTrialSignup(initialFreeTrialSignupState, fd);

    expect(result.status).toBe("success");
    const arg = startTrialMock.mock.calls[0][0];
    expect(arg.consent.marketingConsent).toBe(false);
  });

  it("succeeds and notifies emailStandInPlatformClient.startTrial on valid submission", async () => {
    const fd = buildFormData({ marketingConsent: "on" });
    const result = await submitFreeTrialSignup(initialFreeTrialSignupState, fd);

    expect(result.status).toBe("success");
    expect(startTrialMock).toHaveBeenCalledTimes(1);
    const arg = startTrialMock.mock.calls[0][0];
    expect(arg.adult.firstName).toBe("Qa");
    expect(arg.adult.lastName).toBe("Tester");
    expect(arg.adult.email).toBe("qa-tester@example.invalid");
    expect(arg.consent.marketingConsent).toBe(true);
    expect(arg.offer).toEqual({ offerType: "free-trial", trialLengthDays: 30 });
  });

  it("carries the campaign/source fields through as attribution", async () => {
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

  it("reports success without calling startTrial when the honeypot field is filled", async () => {
    const fd = buildFormData({ company: "I am a bot" });
    const result = await submitFreeTrialSignup(initialFreeTrialSignupState, fd);

    expect(result.status).toBe("success");
    expect(startTrialMock).not.toHaveBeenCalled();
  });
});
