/**
 * Platform-managed free trial provisioning.
 *
 * A platform trial is a Sanity subscription document with:
 *   - status: "trialing"
 *   - trialEnd: now + MAX_TRIAL_DAYS days
 *   - No Stripe IDs (no card required)
 *
 * This is entirely separate from Stripe. The customer never enters payment
 * details to start a trial. Payment is collected only if and when the
 * customer explicitly chooses a paid Monthly or Annual subscription.
 *
 * Unused trial days are never credited, preserved, or extended when the
 * customer upgrades to a paid plan — the paid subscription start date
 * becomes the Stripe billing anchor.
 *
 * SECURITY:
 * - Trial duration is always MAX_TRIAL_DAYS — never from any client input.
 * - Email-based eligibility check prevents repeat trials.
 * - No PII collected beyond email address (already required for registration).
 */

import { sanityWriteClient } from "@/lib/sanity/writeClient";
import { checkTrialEligibility } from "@/lib/trialEligibility";
import { MAX_TRIAL_DAYS } from "@/lib/trialConfig";

export interface PlatformTrialRecord {
  /** Stable UUID — the calling server action sets this as the mtm_sub_ref cookie. */
  correlationRef: string;
  trialStartedAt: string;
  /** ISO 8601 hard expiry: exactly MAX_TRIAL_DAYS after trialStartedAt. */
  trialExpiresAt: string;
}

export type RegisterTrialResult =
  | { success: true; record: PlatformTrialRecord }
  | {
      success: false;
      reason: "already_registered" | "sanity_unavailable" | "error";
    };

/**
 * Provisions a platform-managed free trial for an email address.
 *
 * Creates a Sanity subscription document with status="trialing" and no
 * Stripe IDs. Cookie management is left to the calling server action so
 * this function can be tested in isolation.
 *
 * Returns `already_registered` when the email already has an active or
 * used trial — the calling action should surface a friendly message rather
 * than exposing this reason directly (avoid confirming account existence).
 */
export async function registerPlatformTrial(
  email: string,
  options?: {
    campaignId?: string;
    acquisitionSource?: string;
  },
): Promise<RegisterTrialResult> {
  if (!sanityWriteClient) {
    return { success: false, reason: "sanity_unavailable" };
  }

  const normalisedEmail = email.toLowerCase().trim();

  const eligibility = await checkTrialEligibility(normalisedEmail);
  if (!eligibility.eligible) {
    return { success: false, reason: "already_registered" };
  }

  const correlationRef = crypto.randomUUID();
  const now = new Date();
  const trialStartedAt = now.toISOString();

  const trialExpiry = new Date(now);
  trialExpiry.setDate(trialExpiry.getDate() + MAX_TRIAL_DAYS);
  const trialExpiresAt = trialExpiry.toISOString();

  try {
    await sanityWriteClient.create({
      _type: "subscription",
      correlationRef,
      customerEmail: normalisedEmail,
      status: "trialing",
      trialDays: MAX_TRIAL_DAYS,
      trialEligible: true,
      trialStartedAt,
      trialEnd: trialExpiresAt,
      ...(options?.campaignId && { campaignId: options.campaignId }),
      ...(options?.acquisitionSource && {
        acquisitionSource: options.acquisitionSource,
      }),
      createdAt: trialStartedAt,
      updatedAt: trialStartedAt,
    });
  } catch (err) {
    console.error("Platform trial registration: Sanity create failed:", err);
    return { success: false, reason: "error" };
  }

  return {
    success: true,
    record: { correlationRef, trialStartedAt, trialExpiresAt },
  };
}
