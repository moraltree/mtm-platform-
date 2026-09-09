import type {
  AcquisitionSourceCode,
  CampaignId,
  PartnerId,
  StoryWorldId,
} from "../platform/ids";

/**
 * The minimum field set the architecture proposal's attribution model
 * requires to survive end to end: `partner_id`, `story_world_id`,
 * `campaign_id`, `acquisition_source`, plus the raw UTM values. This
 * repository captures this once at first touch and hands it off intact
 * at conversion (see lib/platform/contract.ts) — it keeps no long-term
 * store of its own (that's the shared platform backend's job).
 */
export interface UtmValues {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
}

/** One touch — either the visitor's first-ever landing or their most
 * recent one. Same shape for both; which cookie it's stored in (see
 * cookie.ts) and how it's allowed to be overwritten (see
 * `resolveAttributionState`) is what makes it "first" or "latest". */
export interface AttributionPayload {
  campaignId: CampaignId;
  partnerId?: PartnerId;
  storyWorldId?: StoryWorldId;
  acquisitionSource?: AcquisitionSourceCode;
  utm: UtmValues;
  /** A locally-generated correlation ID for this touch — not a `UserId`
   * (this repo never mints those), just something to hand to the
   * platform backend alongside the rest of this payload so it can log
   * the touch before an account exists. */
  attributionRef: string;
  /** The path landed on for this touch, e.g. "/start/zulu/blackpool". */
  landingPath: string;
  /** ISO 8601 timestamp of this touch. */
  touchedAt: string;
}

/**
 * Both halves of the model the owner asked Phase 1 to support: who/what
 * originally acquired this visitor (`first`, permanent, never
 * overwritten) and what campaign/source most recently brought them back
 * (`latest`, refreshed on every campaign landing). Both travel together
 * to the platform contract at conversion (see
 * `lib/platform/contract.ts#StartTrialRequest`) — this repo hands off
 * both, it doesn't collapse them into one before handing off.
 */
export interface AttributionState {
  first: AttributionPayload;
  latest: AttributionPayload;
}
