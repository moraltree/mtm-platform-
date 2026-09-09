import { sanityFetch } from "./client";
import { useMockContent } from "./env";
import {
  getMockPage,
  mockExistingPageIds,
  mockFounder,
  mockLeadership,
  mockLegalPages,
  mockNewsPosts,
  mockProducts,
  mockSiteSettings,
  mockStoryWorlds,
} from "../mockContent";
import { defaultCampaignRepository } from "../repository";
import {
  getStoryWorldFromRegistry,
  STORY_WORLD_REGISTRY,
} from "../storyWorlds/registry";
import {
  campaignBelongsToPartner as ruleCampaignBelongsToPartner,
  isCampaignEffectivelyActive,
  isStoryWorldPermitted as ruleIsStoryWorldPermitted,
  resolveCampaignLifecycleStatus,
} from "../campaignRules";
import type {
  AcquisitionSourceField,
  CampaignDoc,
  LegalPageDoc,
  NewsPostDoc,
  PageDoc,
  PageId,
  PersonDoc,
  ProductDoc,
  SiteSettingsDoc,
  StoryWorldDoc,
} from "./types";

// GROQ projections deliberately spell out fields (rather than `...`) so a
// schema change that removes/renames a field surfaces here, not as a
// silent `undefined` deep in a page component.

const SEO_PROJECTION = `seo { metaTitle, metaDescription, ogImage, noIndex }`;

// `link` objects store `internalRef` as a plain {_ref, _type} pointer;
// dereference it here so lib/links.ts#resolveLink gets what it needs
// (which document type, and that document's slug/pageId) without every
// caller re-deriving it.
const LINK_PROJECTION = `
  label, type, externalUrl, openInNewTab,
  internalRef-> { _type, "slug": slug.current, pageId }
`;

// Portable Text's `internalLink` annotation stores its reference the same
// way a `link` field does — dereference it the same way, so
// RichText's `resolveInternalLink` prop (lib/links.ts#resolveInternalRef)
// gets real hrefs instead of unresolvable `{_ref}` pointers. Spliced after
// a body-text field name, e.g. `body${PORTABLE_TEXT_PROJECTION}`.
const PORTABLE_TEXT_PROJECTION = `[] {
  ...,
  markDefs[] {
    ...,
    _type == "internalLink" => {
      "reference": reference-> { _type, "slug": slug.current, pageId }
    }
  }
}`;

// One conditional branch per apps/studio pageBuilder member — see
// lib/pageSections.ts#adaptSections, which turns this raw shape into the
// design system's typed PageSection. Keep the two in sync by hand; there's
// no schema-driven codegen tying them together.
const SECTIONS_PROJECTION = `
  sections[] {
    _type,
    _key,
    _type == "heroBlock" => {
      eyebrow, heading, subheading, media,
      ctas[] { ${LINK_PROJECTION} }
    },
    _type == "richTextBlock" => {
      content, width
    },
    _type == "ctaPanelBlock" => {
      heading, body, tone,
      cta { ${LINK_PROJECTION} }
    },
    _type == "mediaBlock" => {
      mediaType, image, videoUrl, caption, fullBleed
    },
    _type == "quoteBlock" => {
      quote, attribution, role
    },
    _type == "timelineBlock" => {
      heading, entries
    },
    _type == "statsBlock" => {
      heading, stats
    },
    _type == "cardGridBlock" => {
      heading, columns,
      cards[] { title, body, image, link { ${LINK_PROJECTION} } }
    },
    _type == "teamGridBlock" => {
      heading
    },
    _type == "storyWorldGridBlock" => {
      heading
    },
    _type == "newsListBlock" => {
      heading
    },
    _type == "formEmbedBlock" => {
      form, heading, intro
    }
  }
`;

export async function getSiteSettings() {
  const result = await sanityFetch<SiteSettingsDoc>(`
    *[_type == "siteSettings"][0] {
      siteTitle, tagline, logo,
      primaryNav[] { ${LINK_PROJECTION} },
      footerNav[] { ${LINK_PROJECTION} },
      socialLinks[] { ${LINK_PROJECTION} },
      footerNote, contactEmail, contactAddress,
      defaultSeo { metaTitle, metaDescription, ogImage, noIndex },
      consentBanner {
        enabled, message,
        policyLink { ${LINK_PROJECTION} }
      }
    }
  `);
  if (result) return result;
  return useMockContent ? mockSiteSettings : null;
}

export async function getPageByPageId(pageId: PageId) {
  const result = await sanityFetch<PageDoc>(
    `*[_type == "page" && pageId == $pageId][0] {
      _id, pageId, title, slug, ${SECTIONS_PROJECTION}, ${SEO_PROJECTION}
    }`,
    { pageId },
  );
  if (result) return result;
  return useMockContent ? getMockPage(pageId) : null;
}

// Fallback order below is deliberate and the same at each function: a
// real Sanity result always wins; failing that, STORY_WORLD_REGISTRY's
// real (production-visible, ungated) seed content; only failing *that*
// does mockStoryWorlds' fictional/dev-only data apply, and only when
// USE_MOCK_CONTENT is on. See lib/storyWorlds/registry.ts's doc comment.

export async function getStoryWorlds() {
  const result = await sanityFetch<StoryWorldDoc[]>(`
    *[_type == "storyWorld"] | order(order asc) {
      _id, title, slug, tagline, formats, status, heroImage, featured
    }
  `);
  if (result) return result;
  const seeded = useMockContent
    ? [...STORY_WORLD_REGISTRY, ...mockStoryWorlds]
    : STORY_WORLD_REGISTRY;
  return seeded.length > 0 ? seeded : null;
}

export async function getFeaturedStoryWorlds() {
  const result = await sanityFetch<StoryWorldDoc[]>(`
    *[_type == "storyWorld" && featured == true] | order(order asc) {
      _id, title, slug, tagline, formats, status, heroImage
    }
  `);
  if (result) return result;
  const seeded = useMockContent
    ? [...STORY_WORLD_REGISTRY, ...mockStoryWorlds].filter((sw) => sw.featured)
    : STORY_WORLD_REGISTRY.filter((sw) => sw.featured);
  return seeded.length > 0 ? seeded : null;
}

export async function getStoryWorldBySlug(slug: string) {
  const result = await sanityFetch<StoryWorldDoc>(
    `*[_type == "storyWorld" && slug.current == $slug][0] {
      _id, title, slug, tagline, formats, status, heroImage,
      synopsis, gallery, characterRoster,
      ${SECTIONS_PROJECTION}, ${SEO_PROJECTION}
    }`,
    { slug },
  );
  if (result) return result;
  const seeded = getStoryWorldFromRegistry(slug);
  if (seeded) return seeded;
  return useMockContent
    ? (mockStoryWorlds.find((sw) => sw.slug.current === slug) ?? null)
    : null;
}

export async function getNewsPosts(limit = 20) {
  const result = await sanityFetch<NewsPostDoc[]>(
    `*[_type == "newsPost"] | order(publishedAt desc) [0...$limit] {
      _id, title, slug, publishedAt, excerpt, coverImage
    }`,
    { limit },
  );
  if (result) return result;
  return useMockContent ? mockNewsPosts.slice(0, limit) : null;
}

export async function getNewsPostBySlug(slug: string) {
  const result = await sanityFetch<NewsPostDoc>(
    `*[_type == "newsPost" && slug.current == $slug][0] {
      _id, title, slug, publishedAt, excerpt, coverImage,
      body${PORTABLE_TEXT_PROJECTION}, ${SEO_PROJECTION}
    }`,
    { slug },
  );
  if (result) return result;
  return useMockContent
    ? (mockNewsPosts.find((post) => post.slug.current === slug) ?? null)
    : null;
}

export async function getLegalPageBySlug(slug: string) {
  const result = await sanityFetch<LegalPageDoc>(
    `*[_type == "legalPage" && slug.current == $slug][0] {
      _id, title, slug, effectiveDate,
      body${PORTABLE_TEXT_PROJECTION}, ${SEO_PROJECTION}
    }`,
    { slug },
  );
  if (result) return result;
  return useMockContent
    ? (mockLegalPages.find((page) => page.slug.current === slug) ?? null)
    : null;
}

/** Slugs only — for generateStaticParams/sitemap, not page rendering. */
export async function getAllLegalPageSlugs() {
  const result = await sanityFetch<Array<{ slug: string }>>(`
    *[_type == "legalPage"] { "slug": slug.current }
  `);
  if (result) return result;
  return useMockContent
    ? mockLegalPages.map((page) => ({ slug: page.slug.current }))
    : null;
}

const PERSON_PROJECTION = `
  _id, name, role, photo, bio${PORTABLE_TEXT_PROJECTION}, isFounder,
  socialLinks[] { ${LINK_PROJECTION} }
`;

export async function getLeadershipPeople() {
  const result = await sanityFetch<PersonDoc[]>(`
    *[_type == "person" && showOnLeadershipPage == true] | order(order asc) {
      ${PERSON_PROJECTION}
    }
  `);
  if (result) return result;
  return useMockContent ? mockLeadership : null;
}

export async function getFounder() {
  const result = await sanityFetch<PersonDoc>(`
    *[_type == "person" && isFounder == true][0] { ${PERSON_PROJECTION} }
  `);
  if (result) return result;
  return useMockContent ? mockFounder : null;
}

/** pageIds with a real document — for sitemap.ts, which shouldn't list
 * editorial routes that would just 404 (see lib/editorialPage.tsx). */
export async function getExistingPageIds() {
  const result = await sanityFetch<PageId[]>(`*[_type == "page"].pageId`);
  if (result) return result;
  return useMockContent ? mockExistingPageIds : null;
}

const PRODUCT_PROJECTION = `
  _id, title, slug, description${PORTABLE_TEXT_PROJECTION}, images,
  priceType, subscriptionInterval, stripePriceId, active, featured,
  ${SEO_PROJECTION}
`;

export async function getProducts() {
  const result = await sanityFetch<ProductDoc[]>(`
    *[_type == "product" && active != false] | order(order asc) {
      _id, title, slug, images, priceType, stripePriceId, featured
    }
  `);
  if (result) return result;
  return useMockContent ? mockProducts.filter((p) => p.active !== false) : null;
}

export async function getProductBySlug(slug: string) {
  const result = await sanityFetch<ProductDoc>(
    `*[_type == "product" && slug.current == $slug && active != false][0] {
      ${PRODUCT_PROJECTION}
    }`,
    { slug },
  );
  if (result) return result;
  return useMockContent
    ? (mockProducts.find(
        (p) => p.slug.current === slug && p.active !== false,
      ) ?? null)
    : null;
}

/** Slugs only — for generateStaticParams, not page rendering. */
export async function getAllProductSlugs() {
  const result = await sanityFetch<Array<{ slug: string }>>(`
    *[_type == "product" && active != false] { "slug": slug.current }
  `);
  if (result) return result;
  return useMockContent
    ? mockProducts
        .filter((p) => p.active !== false)
        .map((p) => ({ slug: p.slug.current }))
    : null;
}

/**
 * Looks up a product's Sanity `_id` by its `stripePriceId` — used only by
 * the Stripe webhook (app/api/stripe/webhook/route.ts) to link an order's
 * line items back to a `product` document. Deliberately not filtered on
 * `active`: a product later deactivated should still resolve for orders
 * placed while it was active.
 */
export async function getProductByStripePriceId(stripePriceId: string) {
  const result = await sanityFetch<{ _id: string }>(
    `*[_type == "product" && stripePriceId == $stripePriceId][0] { _id }`,
    { stripePriceId },
  );
  if (result) return result;
  if (!useMockContent) return null;
  const match = mockProducts.find((p) => p.stripePriceId === stripePriceId);
  return match ? { _id: match._id } : null;
}

// --- Campaign platform (Partner/Campaign/StoryWorld) ------------------------
// See the architecture proposal's routing model: a Campaign resolves via
// its own `slug` scoped to its Story World's `slug` — never via `key`,
// which is the immutable cross-system identifier (see campaign.ts's doc
// comment), not a routing token.
//
// Phase 4: this section is now a thin service layer over
// `lib/repository` (data access) and `lib/campaignRules` (permission/
// lifecycle rules) — GROQ/mock-array logic moved to the two repository
// adapters; every function below composes their output with the shared
// rules, so both adapters get identical behaviour with no duplicated
// logic between them. Every exported name below is unchanged from
// Phase 1–3 (same signatures, same call sites in `src/proxy.ts`, the
// `/start/[storyWorld]/[campaign]` route, and the tests) except
// `getCampaignByShortCode`, whose richer return shape is new — see its
// own doc comment.

/** Re-exported for backward compatibility with existing imports/tests —
 * the actual implementation now lives in `lib/campaignRules.ts`. */
export const isStoryWorldPermitted = ruleIsStoryWorldPermitted;
/** Re-exported for backward compatibility — see `lib/campaignRules.ts`. */
export const campaignBelongsToPartner = ruleCampaignBelongsToPartner;

/**
 * Full content for rendering `/start/[storyWorld]/[campaign]` — resolves
 * a Campaign by its own slug, scoped to its Story World's slug (so two
 * different Story Worlds may each have a campaign slugged, say,
 * "launch" without colliding). `null` for: no matching document, a
 * Story World not in its Partner's `permittedStoryWorlds`
 * (`isStoryWorldPermitted` — tenant isolation fails closed, not open),
 * or a campaign that isn't *effectively* active right now
 * (`isCampaignEffectivelyActive` — Phase 4: this now also catches a
 * campaign stored as `active` whose `endDate` has passed, not just an
 * explicitly `draft`/`paused`/`archived` one). Rule 1, see CLAUDE.md's
 * null-handling rules: there's no honest partial-render for a campaign
 * that isn't meant to be live.
 */
export async function getCampaignForRoute(
  storyWorldSlug: string,
  campaignSlug: string,
): Promise<CampaignDoc | null> {
  const campaign = await defaultCampaignRepository.findCampaignByRoute(
    storyWorldSlug,
    campaignSlug,
  );
  if (!campaign) return null;
  if (!ruleIsStoryWorldPermitted(campaign)) return null;
  if (!isCampaignEffectivelyActive(campaign)) return null;
  return campaign;
}

/**
 * A deliberately tiny lookup — just the three stable `key` values,
 * nothing else — used only by `src/proxy.ts` to resolve attribution
 * identifiers before the page's own (much larger) `getCampaignForRoute`
 * query runs. Keeping this separate means Proxy's per-request lookup
 * stays cheap; see proxy.ts's own doc comment on why it queries at all.
 *
 * Deliberately does NOT apply `isStoryWorldPermitted` or lifecycle
 * filtering — if either would reject this campaign, Proxy still sets an
 * attribution cookie that never gets used (the page 404s via the
 * authoritative checks in `getCampaignForRoute`), which is harmless, not
 * a tenancy leak or a way to make an inactive campaign look live.
 */
export async function getCampaignIdentifiers(
  storyWorldSlug: string,
  campaignSlug: string,
) {
  return defaultCampaignRepository.findCampaignIdentifiers(
    storyWorldSlug,
    campaignSlug,
  );
}

export async function getPartnerByKey(key: string) {
  return defaultCampaignRepository.findPartnerByKey(key);
}

export async function getStoryWorldByKey(key: string) {
  return defaultCampaignRepository.findStoryWorldByKey(key);
}

/**
 * Prepared for a future custom-domain-aware Proxy — not called from
 * `src/proxy.ts` or anywhere else yet (see the Phase 4 report's custom-
 * domain section for why: real DNS/domain-verification is a separate,
 * external step this phase deliberately doesn't build). Returns the
 * stable `partnerKey`/`campaignKey` a matched domain maps to, never raw
 * content — a future caller still has to go through `getCampaignForRoute`/
 * `getPartnerByKey` and the same permission/theme rules as a normal
 * request; a domain can never become a shortcut around them.
 */
export async function getDomainMapping(domain: string) {
  return defaultCampaignRepository.findByDomain(domain);
}

/**
 * The outcome of resolving a QR/short-link code (see acquisitionSource
 * .ts's `shortCode` field and `/s/[shortCode]/route.ts`) — four distinct
 * cases, not a single null-or-match, because the short-link route needs
 * to tell them apart:
 *
 * - `not-found`: no acquisition source anywhere has this short code (or
 *   the one that does belongs to a campaign a Partner is no longer
 *   permitted to run — see the doc comment inline below). A physically
 *   printed code that never existed, or a config error — a plain 404
 *   is the honest response.
 * - `collision`: **more than one** acquisition source across the whole
 *   platform has this exact short code — a data-integrity failure the
 *   route must fail closed on (never guess which one a visitor meant),
 *   see "short-code collisions are rejected" in the Phase 4 brief.
 * - `inactive`: the code resolves to a real, permitted campaign, but
 *   that campaign isn't effectively active right now (draft/scheduled/
 *   paused/expired/archived — see `reason`) — or its specific
 *   acquisition source was individually deactivated (`reason:
 *   "source-disabled"`, distinct from the campaign's own lifecycle,
 *   which may itself still be `active`). The code itself isn't broken;
 *   whatever's behind it just isn't running. This is what "a campaign
 *   can be paused/deactivated without breaking the printed QR itself"
 *   means concretely: the route redirects to `/campaign-unavailable`
 *   (Phase 5) instead of a dead-end 404.
 * - `active`: resolve and redirect normally.
 */
export type ShortCodeResolution =
  | { status: "not-found" }
  | { status: "collision" }
  | {
      status: "inactive";
      campaign: CampaignDoc;
      source: AcquisitionSourceField;
      reason:
        ReturnType<typeof resolveCampaignLifecycleStatus> | "source-disabled";
    }
  | { status: "active"; campaign: CampaignDoc; source: AcquisitionSourceField };

/**
 * Resolves a QR/short-link code to its canonical campaign — the
 * mechanism behind `/s/[shortCode]`. Looks up the *campaign*, not a
 * slug string (`findCampaignsByShortCode` matches on the shortCode
 * embedded in the campaign's own `acquisitionSources`), so a printed QR
 * code keeps resolving correctly even if the campaign's `slug` is later
 * renamed for SEO/marketing reasons — see campaign.ts's `key`-vs-`slug`
 * doc comment.
 */
export async function getCampaignByShortCode(
  shortCode: string,
): Promise<ShortCodeResolution> {
  const matches =
    await defaultCampaignRepository.findCampaignsByShortCode(shortCode);

  if (matches.length === 0) return { status: "not-found" };

  if (matches.length > 1) {
    console.error(
      `Short-code collision: "${shortCode}" matches ${matches.length} ` +
        "campaigns — refusing to guess which one a visitor meant. Every " +
        "acquisitionSources[].shortCode must be unique across the whole " +
        "platform (see acquisitionSource.ts's own field comment).",
    );
    return { status: "collision" };
  }

  const { campaign, source } = matches[0];

  // A Story-World/Partner mismatch here means the campaign is in an
  // invalid configuration state, not merely paused — treated the same
  // as "not-found" (fail closed), not surfaced as "inactive", so
  // nothing about a permission violation is distinguishable from a
  // code that never existed.
  if (!ruleIsStoryWorldPermitted(campaign)) return { status: "not-found" };

  // Checked before the campaign's own lifecycle: an individually
  // deactivated placement is unavailable regardless of whether the
  // campaign itself is still `active` — reported as its own reason so
  // the two causes are never conflated (see ShortCodeResolution's doc
  // comment).
  if (source.active === false) {
    return { status: "inactive", campaign, source, reason: "source-disabled" };
  }

  const lifecycleStatus = resolveCampaignLifecycleStatus(campaign);
  if (lifecycleStatus !== "active") {
    return { status: "inactive", campaign, source, reason: lifecycleStatus };
  }

  return { status: "active", campaign, source };
}
