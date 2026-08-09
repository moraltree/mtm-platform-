import { sanityFetch } from "./client";
import type {
  LegalPageDoc,
  NewsPostDoc,
  PageDoc,
  PageId,
  PersonDoc,
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
      _id, pageId, title, slug, ${SECTIONS_PROJECTION}, ${SEO_PROJECTION}
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
      synopsis, gallery, ${SECTIONS_PROJECTION}, ${SEO_PROJECTION}
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

const PERSON_PROJECTION = `
  _id, name, role, photo, bio, isFounder,
  socialLinks[] { ${LINK_PROJECTION} }
`;

export async function getLeadershipPeople() {
  return sanityFetch<PersonDoc[]>(`
    *[_type == "person" && showOnLeadershipPage == true] | order(order asc) {
      ${PERSON_PROJECTION}
    }
  `);
}

export async function getFounder() {
  return sanityFetch<PersonDoc>(`
    *[_type == "person" && isFounder == true][0] { ${PERSON_PROJECTION} }
  `);
}

/** pageIds with a real document — for sitemap.ts, which shouldn't list
 * editorial routes that would just 404 (see lib/editorialPage.tsx). */
export async function getExistingPageIds() {
  return sanityFetch<PageId[]>(`*[_type == "page"].pageId`);
}
