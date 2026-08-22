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

// Mirrors apps/studio/schemaTypes/objects/themeTokens.ts — the shared
// theme-override shape reused by partner/storyWorld/campaign. See
// lib/theme/types.ts#ThemeTokens, which this maps onto directly (the
// two are deliberately identical field-for-field; keep them in sync).
export interface ThemeTokensFields {
  colors?: {
    brand?: string;
    brandDark?: string;
    onBrand?: string;
    headingAccent?: string;
    surface?: string;
    surfaceSubtle?: string;
    accentGold?: string;
  };
  typography?: {
    headingFontFamily?: string;
    bodyFontFamily?: string;
  };
}

export interface CharacterRosterEntry {
  name: string;
  portrait?: SanityImageRef;
  relativeScale?: number;
  approvedForCampaign?: boolean;
}

export interface CampaignDefaultsFields {
  headline?: string;
  supportingCopy?: string;
  ctaLabel?: string;
  benefits?: string[];
  trustCopy?: string;
}

export interface StoryWorldDoc {
  _id: string;
  title: string;
  slug: { current: string };
  /** Immutable cross-system identifier — see storyWorld.ts's doc comment.
   * Optional here only because pre-Phase-1 documents predate the field;
   * every consumer that needs a StoryWorldId should treat a missing
   * `key` as "not yet migrated," not silently fall back to `slug`. */
  key?: string;
  tagline?: string;
  shortDescription?: string;
  longDescription?: PortableTextContent;
  formats?: Array<"publishing" | "audiobooks" | "animation">;
  status?: "in-development" | "released" | "announced";
  heroImage: SanityImageRef;
  synopsis?: PortableTextContent;
  gallery?: SanityImageRef[];
  theme?: ThemeTokensFields;
  characterRoster?: CharacterRosterEntry[];
  campaignDefaults?: CampaignDefaultsFields;
  audiobookContentRefs?: string[];
  trialProductMapping?: string;
  sections?: RawSection[];
  featured?: boolean;
  seo?: SeoFields;
  /** Staff-only, never rendered — see storyWorld.ts's field comment. */
  internalNotes?: string;
}

export interface CustomDomainField {
  domain: string;
  verified?: boolean;
  targetCampaign?: { _id: string; slug: { current: string } };
}

/** A single dedicated domain for one Campaign — see CampaignDoc's
 * `customDomain` field comment. Simpler than `CustomDomainField`
 * (Partner's own, plural, array-of-mappings shape): a campaign only
 * ever has one domain of its own, and doesn't need a `targetCampaign`
 * pointer back to itself. */
export interface CampaignCustomDomainField {
  domain: string;
  verified?: boolean;
}

export interface PartnerDoc {
  _id: string;
  name: string;
  key: string;
  slug: { current: string };
  logo?: SanityImageRef;
  favicon?: SanityImageRef;
  theme?: ThemeTokensFields;
  heroImagery?: SanityImageRef;
  brandingTier: "full-mtm" | "co-branded" | "near-white-label";
  broughtToByText?: string;
  showBroughtToBy?: boolean;
  poweredByText?: string;
  showPoweredBy?: boolean;
  footerCopy?: string;
  legalLinks?: LinkField[];
  supportContact?: { email?: string; phone?: string };
  customDomains?: CustomDomainField[];
  permittedStoryWorlds?: StoryWorldDoc[];
  offerRules?: { defaultTrialLengthDays?: number; notes?: string };
  analyticsIds?: { ga4Id?: string; metaPixelId?: string; internalTag?: string };
  status: "active" | "inactive";
  /** Staff-only, never rendered — see partner.ts's field comment. */
  internalNotes?: string;
}

export interface AcquisitionSourceField {
  label: string;
  channelType:
    | "qr"
    | "social"
    | "email"
    | "whatsapp"
    | "paid-ad"
    | "print"
    | "partner-site"
    | "other";
  code: string;
  utmDefaults?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
  };
  shortCode?: string;
  active?: boolean;
}

export interface CampaignDoc {
  _id: string;
  title: string;
  /** Immutable, globally-unique cross-system identifier — the durable
   * business identifier (see campaign.ts's doc comment). Never the
   * routing `slug` below. */
  key: string;
  slug: { current: string };
  partner?: PartnerDoc;
  storyWorld?: StoryWorldDoc;
  theme?: ThemeTokensFields;
  offer?: {
    /** Explicit offer kind — optional and additive (existing campaigns
     * with no `offerType` set still work: every consumer treats a
     * missing value as "free-trial", matching every campaign's actual
     * behaviour before this field existed). See campaign.ts's schema
     * field comment for the full backward-compatibility note. */
    offerType?:
      "free-trial" | "percentage-discount" | "fixed-offer" | "reward-linked";
    trialLengthDays?: number;
    /** Only meaningful when `offerType` is `"percentage-discount"`. */
    discountPercentage?: number;
    /** Only meaningful when `offerType` is `"fixed-offer"` — a short
     * customer-facing label (e.g. "£4.99 for your first month"), not a
     * stored price (see the price-drift note in CLAUDE.md for why this
     * repo never stores an authoritative price next to a Stripe Price
     * reference). */
    fixedOfferLabel?: string;
    /** Only meaningful when `offerType` is `"reward-linked"` — see
     * `lib/rewards/types.ts`. An opaque reference, not a live join: this
     * repo does not look up or validate the rule it points to. */
    rewardRuleKey?: string;
    stripePriceId?: string;
    discountCode?: string;
  };
  headline?: string;
  subheadline?: string;
  heroImageOverride?: SanityImageRef;
  ctaWording?: string;
  supportingCopyOverride?: string;
  sectionOverrides?: Array<"offer" | "benefits" | "storyWorldIntro" | "trust">;
  /** ISO 8601 instants — see lib/campaignRules.ts#resolveCampaignLifecycleStatus
   * for how these combine with `status` into an effective lifecycle state. */
  startDate?: string;
  endDate?: string;
  /** IANA zone (e.g. "Europe/London") — display/input convenience for a
   * future admin UI only. `startDate`/`endDate` are already-stored UTC
   * instants; nothing in this repo needs to convert this at read time —
   * see lib/campaignRules.ts's doc comment. */
  timezone?: string;
  /** What an admin sets — see lib/campaignRules.ts#StoredCampaignStatus
   * for why "the campaign has finished" (`expired`) is deliberately not
   * a settable value here. */
  status: "draft" | "scheduled" | "active" | "paused" | "archived";
  trackingIdentifiers?: {
    internalCode?: string;
    defaultUtm?: {
      source?: string;
      medium?: string;
      campaign?: string;
      content?: string;
    };
  };
  acquisitionSources?: AcquisitionSourceField[];
  /** A dedicated domain for just this campaign — see partner.ts's
   * `customDomains` (the partner-level equivalent) and the Phase 4
   * report's custom-domain section for why both exist. Prepared, not
   * wired into any request-routing path yet. */
  customDomain?: CampaignCustomDomainField;
  /** Phase 5 — optional per-campaign override shown on
   * /campaign-unavailable instead of the generic lifecycle-based
   * default. See campaign.ts's field comment. */
  unavailableMessage?: string;
  /** Staff-only, never rendered — see campaign.ts's field comment. */
  internalNotes?: string;
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
