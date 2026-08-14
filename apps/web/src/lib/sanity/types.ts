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
  // Present on array items (e.g. storyWorld.gallery) — Sanity auto-assigns
  // it to every object in an array regardless of schema/GROQ projection.
  _key?: string;
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

// `internalRef` here is the *dereferenced* shape (queries.ts projects
// `internalRef->{ _type, "slug": slug.current, pageId }`), not the raw
// `{_ref, _type}` pointer — resolveLink() (lib/links.ts) depends on that.
export interface LinkField {
  label: string;
  type: "internal" | "external";
  internalRef?: { _type: string; slug?: string; pageId?: PageId };
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
  | "news"
  | "story-worlds"
  | "shop";

// Raw, undifferentiated pageBuilder entry as it comes back from GROQ (see
// queries.ts's SECTIONS_PROJECTION) — lib/pageSections.ts#adaptSections
// narrows this per `_type` into the design system's typed `PageSection`.
export interface RawSection {
  _type: string;
  _key: string;
  [field: string]: unknown;
}

export interface PageDoc {
  _id: string;
  pageId: PageId;
  title: string;
  slug: { current: string };
  sections?: RawSection[];
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
  sections?: RawSection[];
  featured?: boolean;
  seo?: SeoFields;
}

export interface PersonDoc {
  _id: string;
  name: string;
  role: string;
  photo?: SanityImageRef;
  bio?: PortableTextContent;
  isFounder?: boolean;
  socialLinks?: LinkField[];
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
  seo?: SeoFields;
}

export interface ProductDoc {
  _id: string;
  title: string;
  slug: { current: string };
  description?: PortableTextContent;
  images?: SanityImageRef[];
  priceType: "one-time" | "subscription";
  subscriptionInterval?: "month" | "year";
  // Source of truth for what's actually charged — deliberately not a
  // price stored here too. See lib/stripe.ts#getProductPrice, which
  // fetches the live Stripe Price for display.
  stripePriceId: string;
  active?: boolean;
  featured?: boolean;
  seo?: SeoFields;
}

/** A Stripe Price, resolved live at render time — see lib/stripe.ts. */
export interface ResolvedPrice {
  unitAmount: number; // minor units, e.g. pence
  currency: string; // lowercase ISO code, e.g. "gbp"
  recurringInterval?: "day" | "week" | "month" | "year";
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
