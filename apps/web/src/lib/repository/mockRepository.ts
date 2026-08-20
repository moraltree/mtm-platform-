import { mockCampaigns, mockPartners, mockStoryWorlds } from "../mockContent";
import { devCampaigns, devPartners, devStoryWorlds } from "../devRecords";
import type {
  CampaignIdentifiers,
  CampaignRepository,
  DomainMapping,
  ShortCodeMatch,
} from "./types";

/**
 * The local/dev fixture implementation of `CampaignRepository` — the one
 * real, working adapter today, since no Sanity project exists yet.
 * Purely a data-lookup layer: no status/lifecycle filtering, no
 * `permittedStoryWorlds` check, no theme resolution — see types.ts's
 * file comment on why those stay out of every adapter.
 *
 * `mockContent.ts` (purely fictional demo content) and `devRecords.ts`
 * (River Rangers — real IP, provisional; International Water Company —
 * fictional test partner) are searched together but stay separate files
 * — see devRecords.ts's own doc comment for why.
 */
export const mockCampaignRepository: CampaignRepository = {
  async findCampaignByRoute(storyWorldSlug, campaignSlug) {
    const match = [...mockCampaigns, ...devCampaigns].find(
      (c) =>
        c.slug.current === campaignSlug &&
        c.storyWorld?.slug.current === storyWorldSlug,
    );
    return match ?? null;
  },

  async findCampaignIdentifiers(
    storyWorldSlug,
    campaignSlug,
  ): Promise<CampaignIdentifiers | null> {
    const match = [...mockCampaigns, ...devCampaigns].find(
      (c) =>
        c.slug.current === campaignSlug &&
        c.storyWorld?.slug.current === storyWorldSlug,
    );
    if (!match) return null;
    return {
      key: match.key,
      partnerKey: match.partner?.key,
      storyWorldKey: match.storyWorld?.key,
    };
  },

  async findCampaignsByShortCode(shortCode): Promise<ShortCodeMatch[]> {
    const matches: ShortCodeMatch[] = [];
    for (const campaign of [...mockCampaigns, ...devCampaigns]) {
      const source = campaign.acquisitionSources?.find(
        (s) => s.shortCode === shortCode,
      );
      if (source) matches.push({ campaign, source });
    }
    return matches;
  },

  async findPartnerByKey(key) {
    return [...mockPartners, ...devPartners].find((p) => p.key === key) ?? null;
  },

  async findStoryWorldByKey(key) {
    return (
      [...mockStoryWorlds, ...devStoryWorlds].find((sw) => sw.key === key) ??
      null
    );
  },

  async findByDomain(domain): Promise<DomainMapping | null> {
    for (const partner of [...mockPartners, ...devPartners]) {
      const match = partner.customDomains?.find((d) => d.domain === domain);
      if (match) return { partnerKey: partner.key };
    }
    for (const campaign of [...mockCampaigns, ...devCampaigns]) {
      if (campaign.customDomain?.domain === domain) {
        return { campaignKey: campaign.key, partnerKey: campaign.partner?.key };
      }
    }
    return null;
  },
};
