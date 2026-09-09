import type {
  CampaignDoc,
  LegalPageDoc,
  LinkField,
  NewsPostDoc,
  PageDoc,
  PageId,
  PartnerDoc,
  PersonDoc,
  PortableTextContent,
  ProductDoc,
  RawSection,
  ResolvedPrice,
  SanityImageRef,
  SiteSettingsDoc,
  StoryWorldDoc,
} from "./sanity/types";

/**
 * Stub content used only when USE_MOCK_CONTENT=true (see sanity/env.ts) —
 * lets every route render for visual review without a real Sanity
 * project. Clearly fictional/placeholder throughout (company history,
 * quotes, bios): this is preview scaffolding, not a source of real
 * claims about Moral Tree Media. Never active unless explicitly opted
 * into; production/CI behavior is unaffected by this file existing.
 *
 * Shapes here match what queries.ts's GROQ projections return (already-
 * dereferenced links/images), not raw Studio documents — this is a stand-
 * in for `sanityFetch()`'s result, not for Sanity itself.
 */

let counter = 0;
function key(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

// Exported (Phase 2) so lib/devRecords.ts — real-but-provisional Story
// World data and fictional test-partner data, kept deliberately separate
// from this file's own "purely fictional" content, see that file's doc
// comment — can build the same placeholder-image shape without a second
// implementation. `urlFor()` (lib/sanity/image.ts) already special-cases
// this exact mock ref shape to resolve to /placeholder.png.
export function mockImage(alt: string): SanityImageRef {
  return {
    asset: { _ref: "image-mock-800x600-png", _type: "reference" },
    alt,
    _key: key("img"),
  };
}

function span(text: string, marks: string[] = []) {
  return { _type: "span", _key: key("span"), marks, text };
}

function block(text: string, style: "normal" | "h2" | "h3" | "h4" = "normal") {
  return {
    _type: "block",
    _key: key("block"),
    style,
    markDefs: [],
    children: [span(text)],
  };
}

// A paragraph containing one `internalLink` mark — demonstrates
// RichText's resolveInternalLink end-to-end (see lib/links.ts's
// resolveInternalRef) with content shaped exactly like queries.ts's
// PORTABLE_TEXT_PROJECTION would return it, not hand-waved.
function internalLinkBlock(
  before: string,
  linkText: string,
  after: string,
  ref: { _type: string; slug?: string; pageId?: PageId },
) {
  const markKey = key("markdef");
  return {
    _type: "block",
    _key: key("block"),
    style: "normal",
    markDefs: [{ _type: "internalLink", _key: markKey, reference: ref }],
    children: [span(before), span(linkText, [markKey]), span(after)],
  };
}

function richText(
  ...paragraphs: Array<
    string | ReturnType<typeof block> | ReturnType<typeof internalLinkBlock>
  >
): PortableTextContent {
  return paragraphs.map((p) => (typeof p === "string" ? block(p) : p));
}

function pageLink(label: string, pageId: PageId): LinkField {
  return { label, type: "internal", internalRef: { _type: "page", pageId } };
}

function storyWorldLink(label: string, slug: string): LinkField {
  return {
    label,
    type: "internal",
    internalRef: { _type: "storyWorld", slug },
  };
}

// --- Site settings ---------------------------------------------------

export const mockSiteSettings: SiteSettingsDoc = {
  siteTitle: "Moral Tree Media",
  tagline: "Story worlds with a moral centre, told across every medium.",
  primaryNav: [
    pageLink("About", "about"),
    pageLink("Story Worlds", "story-worlds"),
    pageLink("Publishing", "publishing"),
    pageLink("Audiobooks", "audiobooks"),
    pageLink("Animation", "animation"),
    pageLink("Shop", "shop"),
    pageLink("News", "news"),
    pageLink("Contact", "contact"),
  ],
  footerNav: [
    pageLink("Leadership", "leadership"),
    pageLink("Founder", "founder"),
  ],
  socialLinks: [
    {
      label: "X / Twitter",
      type: "external",
      externalUrl: "https://x.com",
      openInNewTab: true,
    },
  ],
  footerNote: `© ${new Date().getFullYear()} Moral Tree Media (preview data). All rights reserved.`,
  contactEmail: "hello@example.com",
  consentBanner: { enabled: true },
};

// --- Pages -------------------------------------------------------------

function heroSection(
  heading: string,
  subheading: string,
  ctas: LinkField[],
): RawSection {
  return {
    _type: "heroBlock",
    _key: key("hero"),
    eyebrow: "Moral Tree Media",
    heading,
    subheading,
    media: mockImage(""),
    ctas,
  };
}

const mockPages: Partial<Record<PageId, PageDoc>> = {
  home: {
    _id: "mock-page-home",
    pageId: "home",
    title: "Home",
    slug: { current: "" },
    sections: [
      heroSection(
        "Stories with a moral centre, told across every medium",
        "We develop Story Worlds — original fiction built to move fluidly between novels, audiobooks, and animation.",
        [
          storyWorldLink("Explore Story Worlds", "the-last-orchard"),
          pageLink("About us", "about"),
        ],
      ),
      {
        _type: "statsBlock",
        _key: key("stats"),
        heading: "By the numbers",
        stats: [
          { value: "3", label: "Story Worlds" },
          { value: "3", label: "Capability areas" },
          { value: "2019", label: "Founded" },
        ],
      },
      {
        _type: "cardGridBlock",
        _key: key("cards"),
        heading: "What we do",
        columns: 3,
        cards: [
          {
            title: "Publishing",
            body: "Novels and serialised fiction, developed in-house.",
            image: mockImage(""),
            link: pageLink("Visit Publishing", "publishing"),
          },
          {
            title: "Audiobooks",
            body: "Full-cast audio production for every Story World.",
            image: mockImage(""),
            link: pageLink("Visit Audiobooks", "audiobooks"),
          },
          {
            title: "Animation",
            body: "Series and shorts developed alongside the page.",
            image: mockImage(""),
            link: pageLink("Visit Animation", "animation"),
          },
        ],
      },
    ],
  },

  about: {
    _id: "mock-page-about",
    pageId: "about",
    title: "About",
    slug: { current: "about" },
    sections: [
      {
        _type: "richTextBlock",
        _key: key("rt"),
        content: richText(
          block("About Moral Tree Media", "h2"),
          "Moral Tree Media is a story development studio. We build Story Worlds — connected fiction with a consistent ethical core — and take them across publishing, audiobook, and animated formats without losing what made the story worth telling in the first place.",
          "Every project starts on the page. Formats are chosen based on what best serves the story, not the other way around.",
        ),
        width: "narrow",
      },
      {
        _type: "timelineBlock",
        _key: key("tl"),
        heading: "Company history",
        entries: [
          {
            date: "2019",
            title: "Founded",
            body: "Moral Tree Media is established.",
          },
          {
            date: "2021",
            title: "First Story World published",
            body: "The Last Orchard launches in print and digital.",
          },
          {
            date: "2023",
            title: "Audiobook studio opens",
            body: "In-house full-cast audio production begins.",
          },
        ],
      },
    ],
  },

  founder: {
    _id: "mock-page-founder",
    pageId: "founder",
    title: "Founder",
    slug: { current: "founder" },
    sections: [
      {
        _type: "richTextBlock",
        _key: key("rt"),
        content: richText(
          "A short note from our founder on why Moral Tree Media exists.",
        ),
        width: "narrow",
      },
    ],
  },

  leadership: {
    _id: "mock-page-leadership",
    pageId: "leadership",
    title: "Leadership",
    slug: { current: "leadership" },
    sections: [
      {
        _type: "richTextBlock",
        _key: key("rt"),
        content: richText("The people leading Moral Tree Media's studios."),
        width: "narrow",
      },
    ],
  },

  mission: {
    _id: "mock-page-mission",
    pageId: "mission",
    title: "Mission",
    slug: { current: "mission" },
    sections: [
      {
        _type: "richTextBlock",
        _key: key("rt"),
        content: richText(
          block("Our mission", "h2"),
          "We believe stories shape how people treat each other. Our mission is to develop fiction that takes its moral questions seriously without ever losing sight of the story.",
        ),
        width: "narrow",
      },
      {
        _type: "quoteBlock",
        _key: key("quote"),
        quote:
          "The best stories don't tell you what to think — they show you how to feel it.",
        attribution: "Founder name",
        role: "Founder, Moral Tree Media",
      },
    ],
  },

  publishing: {
    _id: "mock-page-publishing",
    pageId: "publishing",
    title: "Publishing",
    slug: { current: "publishing" },
    sections: [
      heroSection(
        "Publishing",
        "Novels and serialised fiction, developed with every future format in mind.",
        [pageLink("Explore Story Worlds", "story-worlds")],
      ),
      {
        _type: "richTextBlock",
        _key: key("rt"),
        content: richText(
          "Our publishing team develops each Story World's foundational text — the novels and serials everything else builds from.",
        ),
        width: "narrow",
      },
      {
        _type: "ctaPanelBlock",
        _key: key("cta"),
        heading: "Interested in publishing rights?",
        body: "Talk to our team about licensing a Story World.",
        cta: pageLink("Get in touch", "contact"),
        tone: "primary",
      },
    ],
  },

  audiobooks: {
    _id: "mock-page-audiobooks",
    pageId: "audiobooks",
    title: "Audiobooks",
    slug: { current: "audiobooks" },
    sections: [
      heroSection(
        "Audiobooks",
        "Full-cast audio production for every Story World we publish.",
        [pageLink("Explore Story Worlds", "story-worlds")],
      ),
      {
        _type: "mediaBlock",
        _key: key("media"),
        mediaType: "image",
        image: mockImage(""),
        caption: "In the studio (preview image).",
      },
      {
        _type: "ctaPanelBlock",
        _key: key("cta"),
        heading: "Looking for audio rights?",
        body: "We produce full-cast audio in-house.",
        cta: pageLink("Get in touch", "contact"),
        tone: "neutral",
      },
    ],
  },

  animation: {
    _id: "mock-page-animation",
    pageId: "animation",
    title: "Animation",
    slug: { current: "animation" },
    sections: [
      heroSection(
        "Animation",
        "Series and shorts developed alongside the page, not after it.",
        [pageLink("Explore Story Worlds", "story-worlds")],
      ),
      {
        _type: "richTextBlock",
        _key: key("rt"),
        content: richText(
          "Our animation studio works from the same story bible as publishing and audio, so every format stays consistent.",
        ),
        width: "narrow",
      },
    ],
  },

  contact: {
    _id: "mock-page-contact",
    pageId: "contact",
    title: "Contact",
    slug: { current: "contact" },
    sections: [
      {
        _type: "richTextBlock",
        _key: key("rt"),
        content: richText("Get in touch with the Moral Tree Media team."),
        width: "narrow",
      },
    ],
  },

  news: {
    _id: "mock-page-news",
    pageId: "news",
    title: "News",
    slug: { current: "news" },
    sections: [
      {
        _type: "richTextBlock",
        _key: key("rt"),
        content: richText("Announcements and updates from Moral Tree Media."),
        width: "narrow",
      },
    ],
  },

  "story-worlds": {
    _id: "mock-page-story-worlds",
    pageId: "story-worlds",
    title: "Story Worlds",
    slug: { current: "story-worlds" },
    sections: [
      {
        _type: "richTextBlock",
        _key: key("rt"),
        content: richText(
          "Every Story World we're developing, across every format.",
        ),
        width: "narrow",
      },
    ],
  },

  shop: {
    _id: "mock-page-shop",
    pageId: "shop",
    title: "Shop",
    slug: { current: "shop" },
    sections: [
      {
        _type: "richTextBlock",
        _key: key("rt"),
        content: richText(
          "Books, audiobooks, and subscriptions from Moral Tree Media — shipped or streamed straight to your family.",
        ),
        width: "narrow",
      },
    ],
  },
};

export function getMockPage(pageId: PageId): PageDoc | null {
  return mockPages[pageId] ?? null;
}

export const mockExistingPageIds: PageId[] = Object.keys(mockPages) as PageId[];

// --- People --------------------------------------------------------------

export const mockFounder: PersonDoc = {
  _id: "mock-person-founder",
  name: "Jordan Ellery",
  role: "Founder & Creative Director",
  photo: mockImage("Portrait of Jordan Ellery"),
  bio: richText(
    "Jordan founded Moral Tree Media in 2019 after a decade writing and editing serialised fiction. They set out to build a studio where a story's ethics could survive contact with three different production pipelines.",
    internalLinkBlock(
      "Our first release under that approach was ",
      "The Last Orchard",
      ", published in 2021.",
      { _type: "storyWorld", slug: "the-last-orchard" },
    ),
  ),
  isFounder: true,
};

export const mockLeadership: PersonDoc[] = [
  mockFounder,
  {
    _id: "mock-person-2",
    name: "Priya Nakamura",
    role: "Head of Publishing",
    photo: mockImage("Portrait of Priya Nakamura"),
  },
  {
    _id: "mock-person-3",
    name: "Marcus Webb",
    role: "Head of Animation",
    photo: mockImage("Portrait of Marcus Webb"),
  },
];

// --- Story Worlds ----------------------------------------------------------

export const mockStoryWorlds: StoryWorldDoc[] = [
  {
    _id: "mock-sw-1",
    title: "The Last Orchard",
    slug: { current: "the-last-orchard" },
    tagline: "A Story World about repair, told across three formats.",
    formats: ["publishing", "audiobooks", "animation"],
    status: "released",
    heroImage: mockImage("The Last Orchard key art"),
    synopsis: richText(
      "When the last working orchard in the valley is condemned, three generations of one family have one harvest left to decide what they owe each other.",
    ),
    gallery: [
      mockImage("Orchard at dawn"),
      mockImage("Family portrait"),
      mockImage("Harvest scene"),
    ],
    featured: true,
  },
  {
    _id: "mock-sw-2",
    title: "Signal House",
    slug: { current: "signal-house" },
    tagline: "A lighthouse keeper's family, and the messages that outlive her.",
    formats: ["publishing", "audiobooks"],
    status: "in-development",
    heroImage: mockImage("Signal House key art"),
    synopsis: richText(
      "A serialised mystery following three siblings who inherit their mother's lighthouse — and the decades of coded radio logs she left behind.",
    ),
    featured: true,
  },
  {
    _id: "mock-sw-3",
    title: "Understory",
    slug: { current: "understory" },
    // Fictional demo data only — used to exercise the campaign platform's
    // Story-World-driven rendering (lib/theme, the /start/[storyWorld]/
    // [campaign] route) under USE_MOCK_CONTENT=true, same "clearly
    // fictional, never a real claim" contract as the rest of this file.
    // Real Story World migration (e.g. Zulu/Savannah Seven) is explicitly
    // deferred — see the architecture proposal's Phase 1 report.
    key: "understory",
    tagline:
      "An animated anthology about the smallest creatures making the biggest decisions.",
    shortDescription:
      "Tiny creatures, big decisions — a campaign-safe one-line pitch.",
    formats: ["animation"],
    status: "announced",
    heroImage: mockImage("Understory key art"),
    characterRoster: [
      {
        name: "Pip",
        portrait: mockImage("Pip the field mouse"),
        relativeScale: 1,
        approvedForCampaign: true,
      },
      {
        name: "Bramble",
        portrait: mockImage("Bramble the beetle"),
        relativeScale: 0.8,
        approvedForCampaign: true,
      },
      {
        name: "Hollow",
        portrait: mockImage("Hollow the owlet"),
        relativeScale: 1.2,
        approvedForCampaign: false,
      },
    ],
    campaignDefaults: {
      headline: "Meet the smallest heroes in the forest.",
      supportingCopy:
        "Bedtime stories about the tiny creatures who keep the whole understory running.",
      ctaLabel: "START THE ADVENTURE",
      benefits: [
        "Calm, screen-free listening",
        "A new episode every night",
        "Stories that reward paying attention to the small things",
      ],
      trustCopy: "Made for families. Reviewed for age-appropriate content.",
    },
    featured: false,
  },
];

// --- Campaign platform (Partner/Campaign) -----------------------------------
// Fictional demo data only — see the Understory entry above's comment.
// Exercises the new /start/[storyWorld]/[campaign] route's Sanity+mock
// query layer (lib/sanity/queries.ts#getCampaignForRoute) end to end
// without depending on a real Sanity project or on real Zulu content.

export const mockPartners: PartnerDoc[] = [
  {
    _id: "mock-partner-1",
    name: "Meadow Cove Nature Trust",
    key: "meadow-cove-nature-trust",
    slug: { current: "meadow-cove-nature-trust" },
    brandingTier: "co-branded",
    broughtToByText: "Meadow Cove Nature Trust",
    showBroughtToBy: true,
    poweredByText: "Powered by Moral Tree Media",
    showPoweredBy: true,
    status: "active",
  },
];

export const mockCampaigns: CampaignDoc[] = [
  {
    _id: "mock-campaign-1",
    title: "Meadow Cove launch campaign",
    key: "meadow-cove-launch",
    slug: { current: "meadow-cove-launch" },
    partner: mockPartners[0],
    storyWorld: mockStoryWorlds.find((sw) => sw.slug.current === "understory"),
    offer: { trialLengthDays: 14 },
    ctaWording: "START THE ADVENTURE",
    status: "active",
    sectionOverrides: [],
    trackingIdentifiers: {
      internalCode: "meadow-cove-2026",
      defaultUtm: { source: "partner-site" },
    },
    acquisitionSources: [
      {
        label: "Nature Trust gift-shop poster",
        channelType: "print",
        code: "meadow-cove-giftshop",
        shortCode: "mc-giftshop",
        active: true,
      },
      {
        label: "Nature Trust Instagram bio link",
        channelType: "social",
        code: "meadow-cove-ig",
        active: true,
      },
    ],
  },
];

// --- News ------------------------------------------------------------------

export const mockNewsPosts: NewsPostDoc[] = [
  {
    _id: "mock-news-1",
    title: "The Last Orchard audiobook now available",
    slug: { current: "last-orchard-audiobook" },
    publishedAt: "2026-06-01T09:00:00.000Z",
    excerpt: "Our full-cast audio production of The Last Orchard is out now.",
    coverImage: mockImage("The Last Orchard audiobook cover"),
    body: richText(
      "We're pleased to announce that the full-cast audiobook of The Last Orchard is now available wherever you get your audiobooks.",
    ),
  },
  {
    _id: "mock-news-2",
    title: "Signal House moves into production",
    slug: { current: "signal-house-production" },
    publishedAt: "2026-04-14T09:00:00.000Z",
    excerpt:
      "Our second Story World, Signal House, has entered full development.",
    body: richText(
      "Signal House, our lighthouse-keeper mystery, has moved from outline into full drafting.",
    ),
  },
  {
    _id: "mock-news-3",
    title: "Moral Tree Media announces Understory",
    slug: { current: "understory-announcement" },
    publishedAt: "2026-01-20T09:00:00.000Z",
    excerpt: "A new animated anthology series enters early development.",
    body: richText(
      "Today we're announcing Understory, an animated anthology in early development.",
    ),
  },
];

// --- Legal -------------------------------------------------------------

export const mockLegalPages: LegalPageDoc[] = [
  {
    _id: "mock-legal-privacy",
    title: "Privacy Policy",
    slug: { current: "privacy-policy" },
    effectiveDate: "2026-01-01",
    body: richText(
      "This is placeholder privacy policy text for preview purposes only — replace with real, legally-reviewed copy before launch.",
    ),
  },
  {
    _id: "mock-legal-terms",
    title: "Terms of Use",
    slug: { current: "terms-of-use" },
    effectiveDate: "2026-01-01",
    body: richText(
      "This is placeholder terms-of-use text for preview purposes only — replace with real, legally-reviewed copy before launch.",
    ),
  },
];

// --- Shop ----------------------------------------------------------------
//
// Mock price IDs here are fake ("price_mock_...") — no real Stripe test
// prices exist. lib/stripe.ts#getProductPrice special-cases these the same
// way, falling back to `mockProductPrices` below instead of a live Stripe
// lookup, whenever Stripe isn't configured and mock content is on.

export const mockProducts: ProductDoc[] = [
  {
    _id: "mock-product-1",
    title: "The Last Orchard — Hardback",
    slug: { current: "the-last-orchard-hardback" },
    description: richText(
      "The full hardback edition of The Last Orchard, our first published Story World.",
    ),
    images: [mockImage("The Last Orchard hardback cover")],
    priceType: "one-time",
    stripePriceId: "price_mock_orchard_hardback",
    active: true,
    featured: true,
  },
  {
    _id: "mock-product-2",
    title: "The Last Orchard — Audiobook",
    slug: { current: "the-last-orchard-audiobook" },
    description: richText(
      "The full-cast audio production of The Last Orchard.",
    ),
    images: [mockImage("The Last Orchard audiobook cover")],
    priceType: "one-time",
    stripePriceId: "price_mock_orchard_audiobook",
    active: true,
    featured: false,
  },
  {
    _id: "mock-product-3",
    title: "Story World Membership",
    slug: { current: "story-world-membership" },
    description: richText(
      "Monthly membership: early access to every new Story World release across print, audio, and animation.",
    ),
    images: [mockImage("Story World Membership artwork")],
    priceType: "subscription",
    subscriptionInterval: "month",
    stripePriceId: "price_mock_membership_monthly",
    active: true,
    featured: true,
  },
];

export const mockProductPrices: Record<string, ResolvedPrice> = {
  price_mock_orchard_hardback: { unitAmount: 1499, currency: "gbp" },
  price_mock_orchard_audiobook: { unitAmount: 999, currency: "gbp" },
  price_mock_membership_monthly: {
    unitAmount: 599,
    currency: "gbp",
    recurringInterval: "month",
  },
};
