import { sanityFetch } from "./client";
import type {
  LegalPageDoc,
  NewsPostDoc,
  PageDoc,
  PageId,
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

export async function getSiteSettings() {
  return sanityFetch<SiteSettingsDoc>(`
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
}

export async function getPageByPageId(pageId: PageId) {
  return sanityFetch<PageDoc>(
    `*[_type == "page" && pageId == $pageId][0] {
      _id, pageId, title, slug, sections, ${SEO_PROJECTION}
    }`,
    { pageId },
  );
}

export async function getStoryWorlds() {
  return sanityFetch<StoryWorldDoc[]>(`
    *[_type == "storyWorld"] | order(order asc) {
      _id, title, slug, tagline, formats, status, heroImage, featured
    }
  `);
}

export async function getFeaturedStoryWorlds() {
  return sanityFetch<StoryWorldDoc[]>(`
    *[_type == "storyWorld" && featured == true] | order(order asc) {
      _id, title, slug, tagline, formats, status, heroImage
    }
  `);
}

export async function getStoryWorldBySlug(slug: string) {
  return sanityFetch<StoryWorldDoc>(
    `*[_type == "storyWorld" && slug.current == $slug][0] {
      _id, title, slug, tagline, formats, status, heroImage,
      synopsis, gallery, sections, ${SEO_PROJECTION}
    }`,
    { slug },
  );
}

export async function getNewsPosts(limit = 20) {
  return sanityFetch<NewsPostDoc[]>(
    `*[_type == "newsPost"] | order(publishedAt desc) [0...$limit] {
      _id, title, slug, publishedAt, excerpt, coverImage
    }`,
    { limit },
  );
}

export async function getNewsPostBySlug(slug: string) {
  return sanityFetch<NewsPostDoc>(
    `*[_type == "newsPost" && slug.current == $slug][0] {
      _id, title, slug, publishedAt, excerpt, coverImage, body, ${SEO_PROJECTION}
    }`,
    { slug },
  );
}

export async function getLegalPageBySlug(slug: string) {
  return sanityFetch<LegalPageDoc>(
    `*[_type == "legalPage" && slug.current == $slug][0] {
      _id, title, slug, effectiveDate, body, ${SEO_PROJECTION}
    }`,
    { slug },
  );
}

/** Slugs only — for generateStaticParams/sitemap, not page rendering. */
export async function getAllLegalPageSlugs() {
  return sanityFetch<Array<{ slug: string }>>(`
    *[_type == "legalPage"] { "slug": slug.current }
  `);
}
