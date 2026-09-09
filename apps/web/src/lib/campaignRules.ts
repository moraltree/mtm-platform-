import type { CampaignDoc } from "./sanity/types";

/**
 * The campaign platform's shared business rules — tenant/Story-World
 * permission enforcement and campaign lifecycle/date resolution. Lives
 * here, deliberately separate from both the repository adapters
 * (lib/repository/) and the route/service layer that calls them
 * (lib/sanity/queries.ts), so the exact same rules apply no matter which
 * repository answered a query — a future Sanity-backed adapter and
 * today's mock/dev-fixture adapter both go through this file, never
 * duplicate its logic themselves. See
 * CAMPAIGN_PLATFORM_CMS_CONTRACT.md's repository-abstraction section.
 */

// --- Tenant / Story-World isolation -----------------------------------------

/**
 * A Partner may restrict itself to specific Story Worlds via
 * `permittedStoryWorlds` (see partner.ts's field comment) — this is the
 * tenant/content-isolation guard that actually enforces it, rather than
 * leaving the field purely descriptive. No restriction configured (an
 * empty/absent list) means unrestricted, same "absence means inherit,
 * not deny" convention the theme resolver uses.
 */
export function isStoryWorldPermitted(candidate: CampaignDoc): boolean {
  const permitted = candidate.partner?.permittedStoryWorlds;
  if (!permitted || permitted.length === 0) return true;
  if (!candidate.storyWorld) return true;
  return permitted.some(
    (sw) =>
      sw._id === candidate.storyWorld!._id ||
      sw.slug.current === candidate.storyWorld!.slug.current,
  );
}

/**
 * The tenant-isolation counterpart to `isStoryWorldPermitted`: does this
 * Campaign actually belong to the Partner it's being accessed on behalf
 * of? Not called anywhere in this repo's own routes yet — the current
 * `/start/[storyWorld]/[campaign]` URL never carries a `partnerId`, so
 * there is no request context to check this against today — but this is
 * exactly the guard a future admin API would need before letting a
 * partner-scoped session read/edit a campaign. Compares by `key`, never
 * `_id` or `slug` — see partner.ts's doc comment on why `key` is the one
 * value safe to compare across systems/time.
 */
export function campaignBelongsToPartner(
  campaign: CampaignDoc,
  partnerKey: string,
): boolean {
  return campaign.partner?.key === partnerKey;
}

// --- Campaign lifecycle / dates ----------------------------------------------

/**
 * What an admin (or, today, a fixture author) actually sets. `archived`
 * replaces the earlier, ambiguous `ended` value (Phase 1–3) — see
 * `CampaignLifecycleStatus` below for why "the campaign has finished"
 * needed to stop being something an admin sets directly at all.
 */
export type StoredCampaignStatus =
  "draft" | "scheduled" | "active" | "paused" | "archived";

/**
 * What actually governs whether a campaign behaves as live right now —
 * `StoredCampaignStatus` plus one computed value, `expired`, that never
 * lives in storage. Phase 4 requirement: a campaign stored as `active`
 * with a past `endDate` must not accidentally keep behaving as a live
 * acquisition campaign, and this must not need a background job to flip
 * a stored field the moment that date passes — `resolveCampaignLifecycle
 * Status` computes it fresh on every request instead, which is safe
 * because Campaign/Partner/Story World reads are already request-time
 * (no caching layer sits in front of them today).
 */
export type CampaignLifecycleStatus = StoredCampaignStatus | "expired";

export interface CampaignLifecycleInput {
  status: StoredCampaignStatus;
  /** ISO 8601. Absent = no scheduled start (eligible immediately, subject
   * to `status`). */
  startDate?: string;
  /** ISO 8601. Absent = no expiry — an intentionally supported campaign
   * shape ("optional no-expiry campaigns", Phase 4). */
  endDate?: string;
}

/**
 * Resolves a campaign's *effective* lifecycle status from its stored
 * `status` plus its dates, at the instant `now` — pure, synchronous, no
 * I/O. `draft`/`paused`/`archived` are admin overrides that win
 * regardless of dates (an admin pausing a campaign mid-flight must take
 * effect immediately, not wait for a date window); only `scheduled`/
 * `active` are actually date-gated, which is what lets a single
 * `active` document naturally become `scheduled` before its start date
 * and `expired` after its end date without anyone editing it in
 * between.
 *
 * `timezone` (Campaign.timezone, if set) is deliberately not a parameter
 * here — `startDate`/`endDate` are already-stored ISO instants (Sanity's
 * `datetime` type), so the comparison below is timezone-agnostic by
 * construction. `timezone` exists purely so an admin UI can show/collect
 * "9am Monday" in a meaningful local time; it never needs to be
 * consulted at resolution time. See CAMPAIGN_PLATFORM_CMS_CONTRACT.md's
 * date-handling section.
 *
 * Malformed date strings degrade safely rather than throwing:
 * `new Date(garbage)` produces an `Invalid Date`, and every comparison
 * against one is `false` — a malformed `startDate` is silently treated
 * as absent (no gating), a malformed `endDate` likewise never expires
 * the campaign. This favours "don't crash the route" over "reject bad
 * config here"; validating date fields at authoring time (Studio) is a
 * separate, complementary concern, not this function's job.
 */
export function resolveCampaignLifecycleStatus(
  campaign: CampaignLifecycleInput,
  now: Date = new Date(),
): CampaignLifecycleStatus {
  if (campaign.status === "draft") return "draft";
  if (campaign.status === "archived") return "archived";
  if (campaign.status === "paused") return "paused";

  if (campaign.startDate && now < new Date(campaign.startDate)) {
    return "scheduled";
  }
  if (campaign.endDate && now > new Date(campaign.endDate)) {
    return "expired";
  }
  return "active";
}

/** Convenience wrapper — the one question every route actually asks. */
export function isCampaignEffectivelyActive(
  campaign: CampaignLifecycleInput,
  now?: Date,
): boolean {
  return resolveCampaignLifecycleStatus(campaign, now) === "active";
}
