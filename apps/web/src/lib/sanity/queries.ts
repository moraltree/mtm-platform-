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

export async function getSiteSettings() {
  return sanityFetch<SiteSettingsDoc>(`
    *[_type == "siteSettings"][0] {
      siteTitle, tagline, logo,
      primaryNav[], footerNav[], socialLinks[],
      footerNote, contactEmail, contactAddress,
      defaultSeo { metaTitle, metaDescription, ogImage, noIndex },
      consentBanner
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
      _id, title, slug, effectiveDate, body
    }`,
    { slug },
  );
}
