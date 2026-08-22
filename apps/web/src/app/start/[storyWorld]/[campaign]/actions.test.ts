import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  StartTrialRequest,
  StartTrialResult,
} from "@/lib/platform/contract";

/**
 * Regression coverage for `submitCampaignSignup`'s authoritative-
 * campaign-lookup fix (PR #1) — the reward-eligibility/offer-spoofing
 * gap where `offer`/`rewardRuleKey` were previously derived from
 * client-editable hidden form fields with no cross-check against the
 * campaign's real Sanity config. Exercises the fixed action directly
 * against the `rewardLinkedTestCampaign` fixture (`lib/devRecords.ts`,
 * added alongside this file specifically to make this test possible —
 * no other fixture in this codebase sets `offerType: "reward-linked"`).
 *
 * Mocks `next/headers` (this action's only dependency that needs a real
 * request context — `cookies()`/`headers()` throw outside one) and
 * `emailStandInPlatformClient.startTrial` (to inspect exactly what
 * `offer`/`rewardEligibility` the action computed, without needing
 * `RESEND_API_KEY`/`FREE_TRIAL_TO_EMAIL` configured).
 */

const cookieStore = new Map<string, { value: string }>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieStore.get(name),
  }),
  headers: async () => ({
    get: (name: string) => (name === "x-forwarded-for" ? "203.0.113.5" : null),
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

const { submitCampaignSignup } = await import("./actions");
const { initialFreeTrialSignupState } =
  await import("@/components/patterns/CampaignLanding/actions");

function buildFormData(overrides: Record<string, string>) {
  const fd = new FormData();
  const base: Record<string, string> = {
    campaign: "test-reward-linked-campaign-dev01",
    firstName: "Qa",
    lastName: "Tester",
    email: "qa-tester@example.invalid",
    adultConfirmed: "on",
    guardianConfirmed: "on",
    legalAccepted: "on",
    storyWorldSlug: "river-rangers",
    campaignSlug: "test-reward-linked",
    ...overrides,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

describe("submitCampaignSignup — reward-eligibility authoritative-lookup fix", () => {
  beforeEach(() => {
    startTrialMock.mockClear();
    cookieStore.clear();
  });

  it("derives rewardEligibility from the campaign's real Sanity offer for a genuinely reward-linked campaign", async () => {
    const fd = buildFormData({});
    const result = await submitCampaignSignup(initialFreeTrialSignupState, fd);

    expect(result.status).toBe("success");
    expect(startTrialMock).toHaveBeenCalledTimes(1);
    const arg = startTrialMock.mock.calls[0][0];
    expect(arg.offer?.offerType).toBe("reward-linked");
    expect(arg.rewardEligibility).toEqual({
      rewardRuleKey: "test-reward-rule-01",
      state: "pending",
    });
  });

  it("ignores spoofed offerType/rewardRuleKey hidden fields for a campaign that is NOT actually reward-linked", async () => {
    // storyWorldSlug/campaignSlug point at the real river-rangers-water-
    // safety campaign (offer.offerType unset -> "free-trial", no
    // rewardRuleKey) — offerType/rewardRuleKey below simulate a visitor
    // tampering the hidden fields via DevTools before submitting.
    const fd = buildFormData({
      campaign: "rr-watersafety-iwc-dev01",
      storyWorldSlug: "river-rangers",
      campaignSlug: "river-rangers-water-safety",
      offerType: "reward-linked",
      rewardRuleKey: "fake-spoofed-key",
      discountPercentage: "9001",
      fixedOfferLabel: "spoofed free money",
    });
    const result = await submitCampaignSignup(initialFreeTrialSignupState, fd);

    expect(result.status).toBe("success");
    expect(startTrialMock).toHaveBeenCalledTimes(1);
    const arg = startTrialMock.mock.calls[0][0];
    // The real campaign's offer: only trialLengthDays is set.
    expect(arg.offer?.offerType).toBeUndefined();
    expect(arg.offer?.trialLengthDays).toBe(30);
    expect(arg.offer?.discountPercentage).toBeUndefined();
    expect(arg.offer?.fixedOfferLabel).toBeUndefined();
    expect(arg.rewardEligibility).toBeUndefined();
  });

  it("degrades to no offer/reward data when the campaign can't be resolved (missing/invalid slugs)", async () => {
    const fd = buildFormData({
      storyWorldSlug: "",
      campaignSlug: "",
      offerType: "reward-linked",
      rewardRuleKey: "fake-spoofed-key",
    });
    const result = await submitCampaignSignup(initialFreeTrialSignupState, fd);

    expect(result.status).toBe("success");
    const arg = startTrialMock.mock.calls[0][0];
    expect(arg.offer?.offerType).toBeUndefined();
    expect(arg.rewardEligibility).toBeUndefined();
  });
});
