import type { ValidationContext } from "sanity";

/**
 * Enforces "short codes are unique" (Phase 4) for `acquisitionSource
 * .shortCode` — a field embedded in an array (`campaign.acquisitionSources`),
 * not a top-level document, so this needs two checks `uniqueKey.ts`'s
 * document-level validator doesn't: siblings within the *same*
 * campaign's array, and every *other* campaign's array. Studio-side
 * validation is the first line of defence; `lib/sanity/queries.ts#get
 * CampaignByShortCode`'s own read-time collision check (see its doc
 * comment) is the second, for data this validator never saw (a direct
 * API write, or content authored before this rule existed).
 */
export function uniqueShortCodeValidation() {
  return async (
    shortCode: string | undefined,
    context: ValidationContext,
  ): Promise<true | string> => {
    if (!shortCode) return true;
    const { document, parent, getClient } = context;
    if (!document?._id) return true;

    const siblings = (
      document as {
        acquisitionSources?: Array<{ _key: string; shortCode?: string }>;
      }
    ).acquisitionSources;
    const currentKey = (parent as { _key?: string } | undefined)?._key;
    const collidesWithSibling = siblings?.some(
      (entry) => entry.shortCode === shortCode && entry._key !== currentKey,
    );
    if (collidesWithSibling) {
      return `Short code "${shortCode}" is already used by another acquisition source on this same campaign.`;
    }

    const client = getClient({ apiVersion: "2025-01-01" });
    const publishedId = document._id.replace(/^drafts\./, "");
    const draftId = `drafts.${publishedId}`;
    const query = `!defined(*[
      _type == "campaign" &&
      !(_id in [$draftId, $publishedId]) &&
      count(acquisitionSources[shortCode == $shortCode]) > 0
    ][0]._id)`;
    const isUnique = await client.fetch(query, {
      draftId,
      publishedId,
      shortCode,
    });
    return (
      isUnique ||
      `Short code "${shortCode}" is already used by another campaign's acquisition source.`
    );
  };
}
