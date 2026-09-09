import type { ValidationContext } from "sanity";

/**
 * Shared uniqueness check for the `key` field on `partner`/`storyWorld`/
 * `campaign` — see each schema's own doc comment for why `key` exists
 * as a field distinct from `slug`: `key` is the immutable identifier
 * external systems (the shared platform backend, the audiobook
 * platform) will eventually store in billing/entitlement records, so it
 * must never collide within its own document type. `slug` keeps
 * Sanity's own built-in uniqueness (via the `slug` field type) and stays
 * free to change for routing/SEO reasons — `key` is not meant to.
 *
 * Scoped per document `_type` (a Partner and a Story World can share the
 * literal string "zulu" as their `key` without conflict — they're
 * different namespaces to any consumer, since the field name a caller
 * uses to reference one vs. the other always differs, e.g. `partner_id`
 * vs `story_world_id`).
 *
 * Same query shape Sanity's own `slug` field uses internally for
 * uniqueness (exclude the current document's draft/published pair, ask
 * whether anything else with this `_type` and `key` exists).
 */
export function uniqueKeyValidation(docType: string) {
  return async (key: string | undefined, context: ValidationContext) => {
    if (!key) return true;
    const { document, getClient } = context;
    if (!document?._id) return true;
    const client = getClient({ apiVersion: "2025-01-01" });
    const publishedId = document._id.replace(/^drafts\./, "");
    const draftId = `drafts.${publishedId}`;
    const query = `!defined(*[
      _type == $docType &&
      !(_id in [$draftId, $publishedId]) &&
      key == $key
    ][0]._id)`;
    const isUnique = await client.fetch(query, {
      docType,
      draftId,
      publishedId,
      key,
    });
    return (
      isUnique ||
      `Another ${docType} document already uses key "${key}" — keys must be unique per document type (see this field's description).`
    );
  };
}
