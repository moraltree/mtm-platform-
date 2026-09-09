import type {
  AcquisitionSourceField,
  CampaignDoc,
  PartnerDoc,
  StoryWorldDoc,
} from "../sanity/types";

/**
 * The repository boundary Phase 4 introduces: everything above this
 * interface (routes, Server Actions, `src/proxy.ts`) and everything in
 * `lib/campaignRules.ts` (permission/lifecycle rules) is written against
 * `CampaignRepository`, never against Sanity or the local fixtures
 * directly. Two implementations exist today —
 * `mockRepository.ts` (the local/dev fixtures) and `sanityRepository.ts`
 * (real Sanity, inert until a project is configured) — composed by
 * `index.ts#defaultCampaignRepository` into the same Sanity-first/mock-
 * fallback behaviour every route already had before this refactor. A
 * third implementation (a different admin/CMS service) is a third file
 * implementing this same interface, not a change to any caller.
 *
 * **No business rules live in an implementation of this interface.**
 * Neither adapter filters by lifecycle status, checks
 * `permittedStoryWorlds`, or resolves theme — they only find records.
 * `lib/campaignRules.ts` and `lib/theme/resolveTheme.ts` apply uniformly
 * to whatever a repository returns, in `lib/sanity/queries.ts` (the
 * service layer), regardless of which repository answered. This is what
 * "do not duplicate business rules inside the adapter" means concretely:
 * if a future adapter needed its own copy of `isStoryWorldPermitted` to
 * behave correctly, the boundary would be in the wrong place.
 */

export interface CampaignIdentifiers {
  key: string;
  partnerKey?: string;
  storyWorldKey?: string;
}

export interface ShortCodeMatch {
  campaign: CampaignDoc;
  source: AcquisitionSourceField;
}

/**
 * A resolved custom-domain mapping — see partner.ts's `customDomains`
 * and campaign.ts's `customDomain` doc comments. Deliberately just the
 * two stable keys, never a raw content object: whatever consumes this
 * (not built yet — see the architecture proposal §13 and the Phase 4
 * report) still has to go through `findCampaignByRoute`/
 * `findPartnerByKey` and `lib/campaignRules.ts` exactly like a normal
 * request, so a domain can never become a shortcut around permission or
 * theme rules.
 */
export interface DomainMapping {
  partnerKey?: string;
  campaignKey?: string;
}

export interface CampaignRepository {
  /** Full campaign content, resolved by its own slug scoped to its Story
   * World's slug. Does NOT filter by status/lifecycle or apply
   * `isStoryWorldPermitted` — see this file's own doc comment for why
   * that's the caller's job, not this method's. `null` only for "no
   * document matches at all". */
  findCampaignByRoute(
    storyWorldSlug: string,
    campaignSlug: string,
  ): Promise<CampaignDoc | null>;

  /** The tiny projection `src/proxy.ts` uses for attribution — same
   * match rule as `findCampaignByRoute`, no status/permission filtering. */
  findCampaignIdentifiers(
    storyWorldSlug: string,
    campaignSlug: string,
  ): Promise<CampaignIdentifiers | null>;

  /**
   * Every campaign/acquisition-source pair whose `shortCode` matches —
   * plural, deliberately: a well-formed short-code system should never
   * have more than one, but the caller (not this method) is what
   * decides that a second match is a collision to fail closed on, not
   * silently pick a winner from. Does not filter by `active`/status.
   */
  findCampaignsByShortCode(shortCode: string): Promise<ShortCodeMatch[]>;

  findPartnerByKey(key: string): Promise<PartnerDoc | null>;
  findStoryWorldByKey(key: string): Promise<StoryWorldDoc | null>;

  /** Prepared, not wired into any route yet — see the Phase 4 report's
   * custom-domain section. */
  findByDomain(domain: string): Promise<DomainMapping | null>;
}
