import { randomUUID } from "node:crypto";
import {
  asAcquisitionSourceCode,
  type CampaignId,
  type PartnerId,
  type StoryWorldId,
} from "../platform/ids";
import type { AttributionPayload, AttributionState, UtmValues } from "./types";

type SearchParams = Record<string, string | string[] | undefined>;

function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}

function extractUtm(searchParams: SearchParams): UtmValues {
  return {
    source: firstString(searchParams.utm_source),
    medium: firstString(searchParams.utm_medium),
    campaign: firstString(searchParams.utm_campaign),
    content: firstString(searchParams.utm_content),
  };
}

/**
 * Builds a fresh `AttributionPayload` (one touch) from an incoming
 * request's search params and the campaign it landed on. Accepts `src`
 * as the internal acquisition-source code (falling back to
 * `utm_source`, matching the precedent already set by `/free30`'s
 * `sourceParam` handling) — see the architecture proposal's acquisition-
 * tracking section for the full list of channels this is meant to
 * distinguish.
 *
 * Pure and synchronous except for `randomUUID()` — does not read or
 * write cookies itself; see `cookie.ts` for that, and
 * `resolveAttributionState` below for how a fresh touch and the two
 * existing cookies are reconciled into first-touch/latest-touch state.
 */
export function buildAttributionPayload(input: {
  campaignId: CampaignId;
  partnerId?: PartnerId;
  storyWorldId?: StoryWorldId;
  searchParams: SearchParams;
  landingPath: string;
}): AttributionPayload {
  const srcParam =
    firstString(input.searchParams.src) ??
    firstString(input.searchParams.source);

  return {
    campaignId: input.campaignId,
    partnerId: input.partnerId,
    storyWorldId: input.storyWorldId,
    acquisitionSource: srcParam ? asAcquisitionSourceCode(srcParam) : undefined,
    utm: extractUtm(input.searchParams),
    attributionRef: randomUUID(),
    landingPath: input.landingPath,
    touchedAt: new Date().toISOString(),
  };
}

export interface ResolvedAttributionState extends AttributionState {
  /** True when this touch became the first-touch record — i.e. no
   * first-touch cookie existed yet. The caller (`src/proxy.ts`) uses
   * this to decide whether the first-touch cookie needs writing at all;
   * per the owner's decision, an existing first-touch record must never
   * be overwritten. */
  firstIsNew: boolean;
}

/**
 * Reconciles a freshly-built touch with whatever the two existing
 * cookies say, implementing both halves of the owner's Phase 1
 * decision as code rather than just policy:
 *
 * - `first` is sticky — an existing, successfully-parsed first-touch
 *   cookie always wins over `fresh`. It is never overwritten, no matter
 *   how many times this visitor lands on a campaign page again. If no
 *   first-touch cookie exists yet, `fresh` *becomes* the first touch.
 * - `latest` always becomes `fresh` — every campaign landing updates
 *   "what most recently brought them back", unconditionally.
 *
 * Pure — see `src/proxy.ts` for where this is actually called and its
 * result written to the two cookies.
 */
export function resolveAttributionState(
  existingFirst: AttributionPayload | null,
  fresh: AttributionPayload,
): ResolvedAttributionState {
  return {
    first: existingFirst ?? fresh,
    latest: fresh,
    firstIsNew: existingFirst === null,
  };
}
