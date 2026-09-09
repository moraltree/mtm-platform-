import { sanityFetch } from "../sanity/client";
import type {
  AcquisitionSourceField,
  CampaignDoc,
  PartnerDoc,
  StoryWorldDoc,
} from "../sanity/types";
import type {
  CampaignIdentifiers,
  CampaignRepository,
  DomainMapping,
} from "./types";

/**
 * The real-Sanity implementation of `CampaignRepository` — inert until
 * `NEXT_PUBLIC_SANITY_PROJECT_ID` is set (`sanityFetch()` returns `null`
 * unconditionally until then, same contract every other query in this
 * codebase already has). No real Sanity project exists yet — this
 * adapter is written and ready, not verified against live content; see
 * the Phase 4 report.
 *
 * GROQ projections moved here unchanged from their pre-Phase-4 home in
 * `lib/sanity/queries.ts` — this file owns "how do I ask Sanity for
 * this shape", nothing about whether the shape is currently allowed to
 * be shown (see types.ts's file comment).
 */

const THEME_TOKENS_PROJECTION = `
  colors { brand, brandDark, onBrand, headingAccent, surface, surfaceSubtle, accentGold },
  typography { headingFontFamily, bodyFontFamily }
`;

const LINK_PROJECTION = `
  label, type, externalUrl, openInNewTab,
  internalRef-> { _type, "slug": slug.current, pageId }
`;

const CAMPAIGN_STORY_WORLD_PROJECTION = `
  _id, title, slug, key, tagline, shortDescription, heroImage,
  theme { ${THEME_TOKENS_PROJECTION} },
  characterRoster[] { name, portrait, relativeScale, approvedForCampaign },
  campaignDefaults { headline, supportingCopy, ctaLabel, benefits, trustCopy }
`;

const CAMPAIGN_PARTNER_PROJECTION = `
  _id, name, key, slug,
  theme { ${THEME_TOKENS_PROJECTION} },
  brandingTier, broughtToByText, showBroughtToBy, poweredByText, showPoweredBy,
  footerCopy, legalLinks[] { ${LINK_PROJECTION} },
  supportContact, status,
  customDomains,
  "permittedStoryWorlds": permittedStoryWorlds[]->{ _id, slug }
`;

const CAMPAIGN_PROJECTION = `
  _id, title, key, slug,
  "partner": partner->{ ${CAMPAIGN_PARTNER_PROJECTION} },
  "storyWorld": storyWorld->{ ${CAMPAIGN_STORY_WORLD_PROJECTION} },
  theme { ${THEME_TOKENS_PROJECTION} },
  offer, headline, subheadline, heroImageOverride, ctaWording,
  supportingCopyOverride, sectionOverrides, startDate, endDate, timezone,
  status, trackingIdentifiers, acquisitionSources, customDomain,
  unavailableMessage
`;

export const sanityCampaignRepository: CampaignRepository = {
  async findCampaignByRoute(storyWorldSlug, campaignSlug) {
    return sanityFetch<CampaignDoc>(
      `*[
        _type == "campaign" &&
        slug.current == $campaignSlug &&
        storyWorld->slug.current == $storyWorldSlug
      ][0] { ${CAMPAIGN_PROJECTION} }`,
      { storyWorldSlug, campaignSlug },
    );
  },

  async findCampaignIdentifiers(storyWorldSlug, campaignSlug) {
    return sanityFetch<CampaignIdentifiers>(
      `*[
        _type == "campaign" &&
        slug.current == $campaignSlug &&
        storyWorld->slug.current == $storyWorldSlug
      ][0] {
        key,
        "partnerKey": partner->key,
        "storyWorldKey": storyWorld->key
      }`,
      { storyWorldSlug, campaignSlug },
    );
  },

  async findCampaignsByShortCode(shortCode) {
    const results = await sanityFetch<
      Array<CampaignDoc & { matchedSource: AcquisitionSourceField }>
    >(
      `*[
        _type == "campaign" &&
        count(acquisitionSources[shortCode == $shortCode]) > 0
      ] {
        ${CAMPAIGN_PROJECTION},
        "matchedSource": acquisitionSources[shortCode == $shortCode][0]
      }`,
      { shortCode },
    );
    if (!results) return [];
    return results.map(({ matchedSource, ...campaign }) => ({
      campaign,
      source: matchedSource,
    }));
  },

  async findPartnerByKey(key) {
    return sanityFetch<PartnerDoc>(
      `*[_type == "partner" && key == $key][0] { ${CAMPAIGN_PARTNER_PROJECTION} }`,
      { key },
    );
  },

  async findStoryWorldByKey(key) {
    return sanityFetch<StoryWorldDoc>(
      `*[_type == "storyWorld" && key == $key][0] { ${CAMPAIGN_STORY_WORLD_PROJECTION} }`,
      { key },
    );
  },

  async findByDomain(domain): Promise<DomainMapping | null> {
    // Two sequential queries, not one combined GROQ expression — GROQ
    // has no clean way to union two differently-shaped bracket queries
    // in a single request. Partner-level mappings are checked first
    // (the more common case — a partner subdomain/custom domain), then
    // a campaign's own dedicated domain.
    const partnerMatch = await sanityFetch<{ partnerKey: string }>(
      `*[_type == "partner" && $domain in customDomains[].domain][0] {
        "partnerKey": key
      }`,
      { domain },
    );
    if (partnerMatch) return partnerMatch;

    const campaignMatch = await sanityFetch<DomainMapping>(
      `*[_type == "campaign" && customDomain.domain == $domain][0] {
        "campaignKey": key,
        "partnerKey": partner->key
      }`,
      { domain },
    );
    return campaignMatch ?? null;
  },
};
