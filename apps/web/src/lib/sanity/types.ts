/**
 * Minimal shapes matching apps/studio's schema, covering only what WP2
 * needs to typecheck the query layer. Refine/expand these as WP5/WP6
 * actually consume each field — don't let this drift into a full manual
 * mirror of the schema.
 */

export interface SanityImageRef {
  asset: { _ref: string; _type: "reference" };
  hotspot?: { x: number; y: number; height: number; width: number };
  alt?: string;
}

export interface SeoFields {
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: SanityImageRef;
  noIndex?: boolean;
}

// Portable Text is intentionally left loose here; render it through a
// dedicated component (WP3) rather than typing every block/mark shape.
export type PortableTextContent = unknown[];

export interface LinkField {
  label: string;
  type: "internal" | "external";
  internalRef?: { _type: string; slug?: { current: string } };
  externalUrl?: string;
  openInNewTab?: boolean;
}

export type PageId =
  | "home"
  | "about"
  | "founder"
  | "leadership"
  | "mission"
  | "publishing"
  | "audiobooks"
  | "animation"
  | "contact"
  | "story-worlds";

export interface PageDoc {
  _id: string;
  pageId: PageId;
  title: string;
  slug: { current: string };
  sections?: unknown[]; // rendered via the page-builder renderer, WP3/WP4
  seo?: SeoFields;
}

export interface StoryWorldDoc {
  _id: string;
  title: string;
  slug: { current: string };
  tagline?: string;
  formats?: Array<"publishing" | "audiobooks" | "animation">;
  status?: "in-development" | "released" | "announced";
  heroImage: SanityImageRef;
  synopsis?: PortableTextContent;
  gallery?: SanityImageRef[];
  sections?: unknown[];
  featured?: boolean;
  seo?: SeoFields;
}

export interface NewsPostDoc {
  _id: string;
  title: string;
  slug: { current: string };
  publishedAt: string;
  excerpt?: string;
  coverImage?: SanityImageRef;
  body: PortableTextContent;
  seo?: SeoFields;
}

export interface LegalPageDoc {
  _id: string;
  title: string;
  slug: { current: string };
  effectiveDate: string;
  body: PortableTextContent;
}

export interface SiteSettingsDoc {
  siteTitle: string;
  tagline?: string;
  logo?: SanityImageRef;
  primaryNav?: LinkField[];
  footerNav?: LinkField[];
  socialLinks?: LinkField[];
  footerNote?: string;
  contactEmail?: string;
  contactAddress?: string;
  defaultSeo?: SeoFields;
  consentBanner?: {
    enabled?: boolean;
    message?: string;
    policyLink?: LinkField;
  };
}
