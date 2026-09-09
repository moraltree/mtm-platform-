/**
 * Trial duration configuration for Moral Tree Media subscriptions.
 *
 * The browser NEVER supplies a trial duration. This module is the single
 * server-side source of truth for how many free-trial days a given visitor
 * is offered based on trusted campaign/acquisition configuration.
 *
 * Resolution order (first match wins):
 *   1. campaignId lookup in TRIAL_DAYS_BY_CAMPAIGN (JSON env var)
 *   2. acquisitionSource lookup in TRIAL_DAYS_BY_SOURCE (JSON env var)
 *   3. DEFAULT_TRIAL_DAYS env var (falls back to STRIPE_TRIAL_PERIOD_DAYS
 *      for backward compatibility)
 *   4. 0 (no trial)
 *
 * Every resolved value is clamped to [0, MAX_TRIAL_DAYS] regardless of
 * source — the 30-day maximum is enforced unconditionally.
 *
 * Example env var configuration:
 *
 *   DEFAULT_TRIAL_DAYS=7
 *   TRIAL_DAYS_BY_CAMPAIGN='{"dentist-campaign":14,"school-autumn-2026":21,"qr-launch-30":30}'
 *   TRIAL_DAYS_BY_SOURCE='{"qr-poster":30,"partner-email":14}'
 *
 * Campaign/offer rules are configured in environment variables — no
 * code change required when adding a new campaign or adjusting a trial
 * length.
 */

export const MAX_TRIAL_DAYS = 30;

/**
 * Clamp any incoming number to the approved [0, 30] range.
 * Non-finite and negative values produce 0 (no trial).
 */
export function clampTrialDays(days: number): number {
  if (!Number.isFinite(days) || days < 0) return 0;
  return Math.min(Math.floor(days), MAX_TRIAL_DAYS);
}

/** Parse a JSON map of id → days from an env var, discarding bad values. */
function parseJsonDaysMap(envVar: string | undefined): Record<string, number> {
  if (!envVar) return {};
  try {
    const parsed: unknown = JSON.parse(envVar);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      console.warn("Trial config: expected a JSON object, got something else:", typeof parsed);
      return {};
    }
    return parsed as Record<string, number>;
  } catch {
    console.warn("Trial config: could not parse JSON env var:", envVar.slice(0, 40));
    return {};
  }
}

/**
 * Resolve the approved trial duration for a given campaign and/or
 * acquisition source. Always called server-side — never from client code.
 *
 * Callers must still check trial eligibility before actually granting a
 * trial — this function only resolves the CONFIGURED duration, not whether
 * the visitor is eligible to receive one.
 *
 * Returns 0 when no trial is configured or all configs resolve to 0.
 */
export function resolveTrialDaysFromConfig(
  campaignId?: string | null,
  acquisitionSource?: string | null,
): number {
  // 1. Campaign-specific override
  if (campaignId) {
    const campaignMap = parseJsonDaysMap(process.env.TRIAL_DAYS_BY_CAMPAIGN);
    if (campaignId in campaignMap) {
      return clampTrialDays(Number(campaignMap[campaignId]));
    }
  }

  // 2. Acquisition-source override
  if (acquisitionSource) {
    const sourceMap = parseJsonDaysMap(process.env.TRIAL_DAYS_BY_SOURCE);
    if (acquisitionSource in sourceMap) {
      return clampTrialDays(Number(sourceMap[acquisitionSource]));
    }
  }

  // 3. Default — prefer DEFAULT_TRIAL_DAYS; STRIPE_TRIAL_PERIOD_DAYS kept
  //    for backward compatibility with the initial v1 deployment.
  const defaultStr =
    process.env.DEFAULT_TRIAL_DAYS ?? process.env.STRIPE_TRIAL_PERIOD_DAYS;
  if (defaultStr) {
    const parsed = parseInt(defaultStr, 10);
    return clampTrialDays(isNaN(parsed) ? 0 : parsed);
  }

  return 0;
}
