import { useMockContent } from "../sanity/env";
import { mockCampaignRepository } from "./mockRepository";
import { sanityCampaignRepository } from "./sanityRepository";
import type { CampaignRepository } from "./types";

export type {
  CampaignIdentifiers,
  CampaignRepository,
  DomainMapping,
  ShortCodeMatch,
} from "./types";

/**
 * Sanity-first, mock-fallback — the exact composition every campaign-
 * platform query already had before Phase 4's refactor, now expressed
 * as one composite `CampaignRepository` implementation instead of an
 * `if (result) ... else if (useMockContent) ...` block repeated inside
 * every function in `lib/sanity/queries.ts`. `useMockContent` gates the
 * fallback the same way it already gates every other mock-content path
 * in this codebase (see sanity/env.ts) — mock data never activates
 * outside an explicit opt-in, regardless of why Sanity returned nothing.
 *
 * This is the one place a caller should import from — `lib/sanity/
 * queries.ts`'s campaign-platform functions do, and any future caller
 * should too, rather than reaching into `mockRepository`/
 * `sanityRepository` directly.
 */
function compose(): CampaignRepository {
  return {
    async findCampaignByRoute(storyWorldSlug, campaignSlug) {
      const result = await sanityCampaignRepository.findCampaignByRoute(
        storyWorldSlug,
        campaignSlug,
      );
      if (result) return result;
      if (!useMockContent) return null;
      return mockCampaignRepository.findCampaignByRoute(
        storyWorldSlug,
        campaignSlug,
      );
    },

    async findCampaignIdentifiers(storyWorldSlug, campaignSlug) {
      const result = await sanityCampaignRepository.findCampaignIdentifiers(
        storyWorldSlug,
        campaignSlug,
      );
      if (result) return result;
      if (!useMockContent) return null;
      return mockCampaignRepository.findCampaignIdentifiers(
        storyWorldSlug,
        campaignSlug,
      );
    },

    async findCampaignsByShortCode(shortCode) {
      const results =
        await sanityCampaignRepository.findCampaignsByShortCode(shortCode);
      if (results.length > 0) return results;
      if (!useMockContent) return [];
      return mockCampaignRepository.findCampaignsByShortCode(shortCode);
    },

    async findPartnerByKey(key) {
      const result = await sanityCampaignRepository.findPartnerByKey(key);
      if (result) return result;
      if (!useMockContent) return null;
      return mockCampaignRepository.findPartnerByKey(key);
    },

    async findStoryWorldByKey(key) {
      const result = await sanityCampaignRepository.findStoryWorldByKey(key);
      if (result) return result;
      if (!useMockContent) return null;
      return mockCampaignRepository.findStoryWorldByKey(key);
    },

    async findByDomain(domain) {
      const result = await sanityCampaignRepository.findByDomain(domain);
      if (result) return result;
      if (!useMockContent) return null;
      return mockCampaignRepository.findByDomain(domain);
    },
  };
}

export const defaultCampaignRepository: CampaignRepository = compose();
