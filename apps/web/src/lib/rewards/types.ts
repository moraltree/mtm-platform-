import type { CampaignId, PartnerId, RewardRuleKey } from "../platform/ids";

/**
 * Typed contract for the future partner reward/voucher architecture
 * (see the owner's brief, item 7). **Nothing in this file issues,
 * stores, or redeems a real reward** — there is no reward/voucher
 * database, no redemption endpoint, and no partner-specific logic
 * anywhere in this codebase. This exists so `StartTrialRequest`
 * (`../platform/contract.ts`) and a future Campaign `offer` can carry
 * reward *eligibility metadata* in a stable shape now, the same
 * "typed boundary, real implementation later" pattern as
 * `PlatformClient` itself and `AdminOperations`.
 *
 * Deliberately partner-agnostic: no partner name, retailer, or venue is
 * named anywhere in this file or its callers. A real partner's actual
 * reward rule (what qualifies, what's issued, redemption mechanics) is
 * future partner-agreement content entered against this shape — never
 * hard-coded here.
 */

/** The kind of reward a qualifying conversion might unlock. Deliberately
 * generic — no real partner or product is named. */
export type RewardType =
  | "retail-voucher"
  | "store-credit"
  | "free-product"
  | "admission-voucher"
  | "promotional-bundle";

/** What has to happen for a reward to become eligible. Today only
 * `campaignId`/`partnerId` scoping plus a qualifying-event category
 * exist — a real rule engine (spend thresholds, product SKUs, etc.) is
 * out of scope until a real partner integration is approved. */
export interface RewardTrigger {
  /** The event category that would satisfy this rule. Distinct from
   * the conversion-tracking events in `lib/analytics/events.ts` — this
   * is business-rule vocabulary ("what qualifies"), not an analytics
   * event name, even though `"subscription-started"` and
   * `"trial-converted"` will typically correlate with one. */
  qualifyingEvent:
    | "trial-started"
    | "trial-converted-to-subscription"
    | "subscription-started"
    | "qualifying-purchase-completed";
  /** Optional free-text description of any additional condition (e.g.
   * "first 500 redemptions", "UK only") — staff-facing only, never
   * parsed/enforced by code today. A real rule engine would replace
   * this with structured fields once one is built. */
  notes?: string;
}

/** A partner-agnostic reward rule — the shape a future admin/config
 * surface would populate per partner/campaign. Not a Sanity document
 * type (yet): keeping this TypeScript-only avoids standing up a new
 * CMS/admin write surface before a real reward programme is approved,
 * per the "typed contracts only" instruction. */
export interface PartnerRewardRule {
  /** Stable, opaque key this repo mints — never a real coupon/voucher
   * code (see `RewardRuleKey`'s own doc comment). */
  key: RewardRuleKey;
  partnerId: PartnerId;
  /** Optional — a reward rule may apply platform-wide for a partner
   * (any of their campaigns) or be scoped to one specific campaign. */
  campaignId?: CampaignId;
  rewardType: RewardType;
  trigger: RewardTrigger;
  /** Customer-facing summary of the reward (e.g. "10% off your next
   * order") — staff enters this; never fabricated by this repo. */
  description?: string;
  active: boolean;
}

/** Where a given customer/conversion currently stands against a reward
 * rule. `"not-applicable"` (no rule configured) and `"pending"` (a rule
 * exists but the qualifying event hasn't happened yet) are the only
 * states any code in this repo can honestly assert today — `"eligible"`/
 * `"issued"`/`"redeemed"` are reserved for the future system that
 * actually evaluates and fulfils rewards. */
export type RewardEligibilityState =
  "not-applicable" | "pending" | "eligible" | "issued" | "redeemed";

/** Carried on `StartTrialRequest` (`../platform/contract.ts`) so the
 * future shared platform backend receives whichever reward rule a
 * campaign is configured with, without this repo ever evaluating,
 * granting, or persisting the reward itself. */
export interface RewardEligibilityMetadata {
  rewardRuleKey?: RewardRuleKey;
  rewardType?: RewardType;
  state: RewardEligibilityState;
}
