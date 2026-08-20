/**
 * Stable, cross-system identifiers — see the architecture proposal's
 * "Stable cross-system identifiers" table for who mints each one and
 * where it lives. Branded (nominal) string types, not bare `string`, so
 * it's a compile-time error to pass a `StoryWorldId` where a `UserId` is
 * expected, or vice versa — a concrete, type-level enforcement of the
 * "brand config is type-disjoint from business logic" rule in the
 * proposal's tenancy/security section, not just a naming convention.
 *
 * This repository mints `PartnerId`/`StoryWorldId`/`CampaignId` (as each
 * document's `key` field in Sanity — never its internal `_id`, which is
 * a Sanity/dataset implementation detail, not a stable cross-system
 * contract). It never mints `UserId`, `SubscriptionId`, or `ContentId` —
 * those belong to the shared platform backend and the external
 * audiobook platform respectively, and only ever arrive here as opaque
 * values received from those systems.
 */

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

/** Minted by this repository (a Partner document's `key`). */
export type PartnerId = Brand<string, "PartnerId">;
/** Minted by this repository (a Story World document's `key`). */
export type StoryWorldId = Brand<string, "StoryWorldId">;
/** Minted by this repository (a Campaign document's `key`). */
export type CampaignId = Brand<string, "CampaignId">;

/** Minted by the shared platform backend — this repo never creates one,
 * only receives it transiently (e.g. in a signed callback) once an
 * account exists. */
export type UserId = Brand<string, "UserId">;
/** Minted by Stripe / the shared platform backend's entitlement layer —
 * for content subscriptions. This repo's own shop (WP7) has its own,
 * unrelated Stripe subscription usage that does not use this type. */
export type SubscriptionId = Brand<string, "SubscriptionId">;
/** A Stripe Price ID — this repo references these (shop products and
 * `Campaign.offer.stripePriceId`) but does not own what entitlement a
 * content-product Price maps to. */
export type ProductId = Brand<string, "ProductId">;
/** Minted by the external audiobook platform's own catalogue — an
 * opaque foreign key wherever this repo stores one (see
 * `StoryWorld.audiobookContentRefs`). */
export type ContentId = Brand<string, "ContentId">;
/** The `code` on an `AcquisitionSource` — this repo mints these. */
export type AcquisitionSourceCode = Brand<string, "AcquisitionSourceCode">;

/**
 * Brand a raw string as one of the above. A cast, not a validator — call
 * it once, at the boundary where a value is first known to be that kind
 * of ID (e.g. right after reading `campaign.key` from a Sanity query
 * result), not scattered throughout calling code.
 */
export function asPartnerId(value: string): PartnerId {
  return value as PartnerId;
}
export function asStoryWorldId(value: string): StoryWorldId {
  return value as StoryWorldId;
}
export function asCampaignId(value: string): CampaignId {
  return value as CampaignId;
}
export function asUserId(value: string): UserId {
  return value as UserId;
}
export function asSubscriptionId(value: string): SubscriptionId {
  return value as SubscriptionId;
}
export function asProductId(value: string): ProductId {
  return value as ProductId;
}
export function asContentId(value: string): ContentId {
  return value as ContentId;
}
export function asAcquisitionSourceCode(value: string): AcquisitionSourceCode {
  return value as AcquisitionSourceCode;
}
