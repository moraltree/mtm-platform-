/**
 * Trial eligibility — prevents an account holder from receiving a second
 * Stripe-managed free trial simply by retrying checkout, changing campaign
 * URLs, abandoning and restarting, or switching device.
 *
 * ELIGIBILITY MODEL
 * The strongest check supportable without invasive fingerprinting or a full
 * account system is email-based: we look in Sanity for an existing subscription
 * record that (a) has this email, (b) has trialDays > 0, and (c) is not in
 * "incomplete" status — meaning a trial was actually activated, not just a
 * checkout that was abandoned before Stripe confirmed anything.
 *
 * KNOWN LIMITATION — FOUNDER DECISION REQUIRED
 * A visitor can bypass this by using a different email address. Without
 * invasive device fingerprinting (which we deliberately avoid) or a proper
 * account system, this limitation is unavoidable. Mitigation: Stripe itself
 * enforces one trial per payment method when `trial_period_days` is set,
 * which significantly reduces the practical value of an email bypass.
 * The conservative recommendation is to accept this limitation for v1 and
 * revisit when an account system is added.
 *
 * FAIL-OPEN POLICY
 * When Sanity is not configured or the query fails, eligibility returns
 * ELIGIBLE — we do not block genuine subscribers because of an infrastructure
 * issue.
 */

import { sanityWriteClient } from "./sanity/writeClient";

export type TrialEligibility =
  | { eligible: true }
  | { eligible: false; reason: string };

/**
 * Check whether this email address is eligible for a new free trial.
 *
 * Returns { eligible: true } when:
 * - Sanity write client is not configured (fail-open)
 * - No prior subscription record with trialDays > 0 and a confirmed status
 *
 * Returns { eligible: false, reason } when a prior activated trial exists.
 *
 * "Confirmed" means status is NOT "incomplete" — an abandoned checkout
 * (incomplete) should not permanently block a visitor from retrying.
 */
export async function checkTrialEligibility(
  email: string,
): Promise<TrialEligibility> {
  if (!sanityWriteClient || !email) return { eligible: true };

  const normalised = email.toLowerCase().trim();
  if (!normalised) return { eligible: true };

  try {
    const existing = await sanityWriteClient.fetch<{ _id: string } | null>(
      `*[
        _type == "subscription" &&
        customerEmail == $email &&
        trialDays > 0 &&
        status != "incomplete"
      ][0] { _id }`,
      { email: normalised },
    );

    if (existing) {
      return {
        eligible: false,
        reason:
          "A free trial has already been used on this account. " +
          "To continue with full access please choose a subscription plan.",
      };
    }

    return { eligible: true };
  } catch (err) {
    // Fail-open: infrastructure issues must not silently block genuine trials.
    console.warn(
      "Trial eligibility check failed — treating as eligible to avoid " +
        "blocking genuine subscribers:",
      err,
    );
    return { eligible: true };
  }
}
