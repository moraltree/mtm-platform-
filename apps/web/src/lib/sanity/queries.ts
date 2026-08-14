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
import type {
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

export async function getStoryWorlds() {
  const result = await sanityFetch<StoryWorldDoc[]>(`
    *[_type == "storyWorld"] | order(order asc) {
      _id, title, slug, tagline, formats, status, heroImage, featured
    }
  `);
  if (result) return result;
  return useMockContent ? mockStoryWorlds : null;
}

export async function getFeaturedStoryWorlds() {
  const result = await sanityFetch<StoryWorldDoc[]>(`
    *[_type == "storyWorld" && featured == true] | order(order asc) {
      _id, title, slug, tagline, formats, status, heroImage
    }
  `);
  if (result) return result;
  return useMockContent ? mockStoryWorlds.filter((sw) => sw.featured) : null;
}

export async function getStoryWorldBySlug(slug: string) {
  const result = await sanityFetch<StoryWorldDoc>(
    `*[_type == "storyWorld" && slug.current == $slug][0] {
      _id, title, slug, tagline, formats, status, heroImage,
      synopsis, gallery, ${SECTIONS_PROJECTION}, ${SEO_PROJECTION}
    }`,
    { slug },
  );
  if (result) return result;
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
