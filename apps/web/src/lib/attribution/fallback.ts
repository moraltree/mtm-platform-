import { randomUUID } from "node:crypto";
import { asCampaignId } from "../platform/ids";
import type { AttributionPayload } from "./types";

/**
 * Honest minimal fallback for a visitor with no attribution cookie at
 * all (blocked, cleared, or — for `/free30`, which `src/proxy.ts` never
 * writes cookies for at all — never set in the first place). Built only
 * from whatever the submitted form actually carried, never fabricated
 * beyond that. Extracted from what was previously duplicated,
 * near-identically, in both
 * `app/start/[storyWorld]/[campaign]/actions.ts` and (as of this
 * registration-flow extension) `components/patterns/CampaignLanding/
 * actions.ts` — see either call site for how it's used.
 */
export function buildFallbackAttributionPayload(
  campaignIdValue: string,
): AttributionPayload {
  return {
    campaignId: asCampaignId(campaignIdValue || "unknown"),
    utm: {},
    attributionRef: randomUUID(),
    landingPath: "unknown",
    touchedAt: new Date().toISOString(),
  };
}
