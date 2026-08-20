import { mockImage } from "./mockContent";
import type { CampaignDoc, PartnerDoc, StoryWorldDoc } from "./sanity/types";

/**
 * Phase 2 architecture-validation fixtures — River Rangers (a real,
 * developing Moral Tree Media Story World) and International Water
 * Company (an entirely fictional test partner). Deliberately kept in a
 * separate file from `mockContent.ts`, whose own doc comment describes
 * its contents as "clearly fictional/placeholder throughout... not a
 * source of real claims about Moral Tree Media" — River Rangers is a
 * real property, so mixing it into that file would misdescribe it
 * either way (as fictional demo IP, or the fictional demo content as
 * real). Read each fixture's own comment for its specific provenance —
 * "real Story World, provisional field values" and "entirely fictional,
 * test-only" are two different claims, not interchangeable.
 *
 * Used only when `USE_MOCK_CONTENT=true` (no real Sanity project exists
 * yet — see `sanity/env.ts`), via `sanity/queries.ts`'s mock fallback,
 * exactly like `mockContent.ts`'s existing fixtures. **No new route or
 * component code was written for River Rangers/International Water
 * Company** — the entire Phase 1 `/start/[storyWorld]/[campaign]`
 * pipeline (routing, theme resolution, attribution, the generic
 * `CampaignLanding` props) is reused unchanged; this file is pure
 * configuration, which is the thing Phase 2 sets out to prove.
 *
 * Every character name below that isn't already established in project
 * planning (Benny, Barney, Coco, Boomer) is a generic role label
 * ("River Otter", "Pelican", "Elderly Turtle"), not an invented proper
 * name — see each entry's own comment. No biography, personality, or
 * lore is invented for any of them.
 */

// --- River Rangers (real Story World; provisional field values) ------------
//
// The master asset library (~/mtm-assets/story-worlds/river-rangers/)
// confirms River Rangers as a scaffolded, real Story World slot, but
// contains zero artwork or character-manifest files — unlike
// zulu-savannah-seven's populated library. Every image reference below
// is therefore the same placeholder mechanism `mockContent.ts` already
// uses elsewhere (resolves to /placeholder.png via urlFor's mock
// handling), not real artwork. The theme palette and all copy are
// development values only — no final River Rangers brand system has
// been approved. See each field's inline comment for specifics.

export const riverRangersStoryWorld: StoryWorldDoc = {
  _id: "dev-sw-river-rangers",
  title: "River Rangers",
  slug: { current: "river-rangers" },
  key: "river-rangers",
  tagline: "Friends of the river, exploring and caring for their wetland home.",
  shortDescription:
    "PROVISIONAL — a growing group of river and wetland animal friends " +
    "who explore, adventure, and look after the waterways they call home.",
  formats: ["audiobooks"],
  status: "in-development",
  heroImage: mockImage(
    "River Rangers placeholder hero art — no approved artwork exists yet",
  ),
  theme: {
    colors: {
      // Provisional natural river palette — greens/blues, deliberately
      // distinct from Zulu/Savannah Seven's warm brown-and-cream family
      // (see CampaignLanding.module.css's file comment on that palette)
      // while still sitting in the same "warm, premium storybook" register
      // via the shared earth-tone accent below. Not an approved brand system.
      brand: "#2f6f5e",
      brandDark: "#204d40",
      onBrand: "#fdfaf3",
      headingAccent: "#1f4a3d",
      surface: "#eef6f2",
      surfaceSubtle: "#dcece4",
      // A deep ochre/bronze — checked by hand against this Story
      // World's own `surface` above (~4.6:1, clears the 3:1 non-text
      // minimum with room to spare). An earlier draft value (#c9a35a,
      // a lighter gold) failed that same check and was correctly
      // rejected at render time — see the Phase 2 report's theme-
      // validation findings for what that looked like and why it's a
      // feature, not a bug, of lib/theme/contrast.ts.
      accentGold: "#8a6a2e",
    },
  },
  characterRoster: [
    {
      name: "Benny",
      portrait: mockImage(
        "Benny the beaver — placeholder, no approved artwork",
      ),
      relativeScale: 1.1,
      approvedForCampaign: true,
    },
    {
      name: "Barney",
      portrait: mockImage(
        "Barney the beaver — placeholder, no approved artwork",
      ),
      relativeScale: 1.0,
      approvedForCampaign: true,
    },
    {
      name: "Coco",
      portrait: mockImage(
        "Coco the crocodile — placeholder, no approved artwork",
      ),
      relativeScale: 1.4,
      approvedForCampaign: true,
    },
    {
      name: "Boomer",
      portrait: mockImage(
        "Boomer the bullfrog (big and loud) — placeholder, no approved artwork",
      ),
      relativeScale: 1.3,
      approvedForCampaign: true,
    },
    {
      // Generic role label, not an invented proper name — the brief
      // describes "a river otter" without naming one.
      name: "River Otter",
      portrait: mockImage(
        "River otter — unnamed in project materials, placeholder only",
      ),
      relativeScale: 0.9,
      approvedForCampaign: true,
    },
    {
      // Generic role label — "a pelican" is unnamed in project materials.
      // Deliberately left unapproved (approvedForCampaign: false) to
      // re-prove, for a second and independent Story World, the same
      // roster-exclusion mechanism Phase 1 proved with Understory's
      // "Hollow" entry — this flag is per-character, per-Story-World,
      // not a global switch.
      name: "Pelican",
      portrait: mockImage(
        "Pelican — unnamed in project materials, placeholder only",
      ),
      relativeScale: 1.2,
      approvedForCampaign: false,
    },
    {
      // Generic role label — "an elderly turtle" is unnamed in project
      // materials.
      name: "Elderly Turtle",
      portrait: mockImage(
        "Elderly turtle — unnamed in project materials, placeholder only",
      ),
      relativeScale: 0.8,
      approvedForCampaign: true,
    },
  ],
  campaignDefaults: {
    // Deliberately general — friendship/adventure/rivers/wildlife/care
    // for the environment, per the brief's instruction that water safety
    // (or any other single theme) must not be hard-coded permanently
    // into River Rangers itself. Water-safety-specific framing lives on
    // the *campaign* document instead (see below) — a different River
    // Rangers campaign later would inherit this general positioning,
    // not a water-safety slant it never asked for.
    headline: "Adventures along the river, every night.",
    supportingCopy:
      "PROVISIONAL — join the River Rangers as they explore wetlands, " +
      "look after their river home, and share bedtime adventures together.",
    ctaLabel: "START THE ADVENTURE",
    benefits: [
      "Calm, screen-free listening",
      "A new river adventure every night",
      "Stories that build care for nature",
    ],
    trustCopy:
      "PROVISIONAL — made for families, with age-appropriate outdoor-adventure themes.",
  },
  audiobookContentRefs: [],
  featured: false,
  internalNotes:
    "PROVISIONAL — Phase 2 architecture-validation configuration. " +
    "River Rangers is a real, developing Moral Tree Media Story World " +
    "(confirmed via ~/mtm-assets/story-worlds/river-rangers/, which " +
    "exists as a scaffolded slot but contains no artwork or character " +
    "manifest yet). Character roster reuses only the names already " +
    "established in project planning (Benny, Barney, Coco, Boomer); " +
    "River Otter/Pelican/Elderly Turtle are generic role labels, not " +
    "canonical names. Theme palette, hero image, and all copy are " +
    "development values pending real creative approval — no final " +
    "brand system exists yet. Do not promote to canonical without " +
    "explicit approval.",
};

// --- International Water Company (entirely fictional; test-only) -----------
//
// Created solely to exercise the Partner/Tenant architecture. Not a
// real company, customer, commercial partner, sponsor, or endorsement
// of any kind — see `internalNotes` and `footerCopy` below, both of
// which say so explicitly and are meant to keep saying so wherever this
// record is read.

export const internationalWaterCompanyPartner: PartnerDoc = {
  _id: "dev-partner-international-water-company",
  name: "International Water Company",
  key: "international-water-company",
  slug: { current: "international-water-company" },
  logo: mockImage(
    "International Water Company placeholder logo — fictional test partner",
  ),
  theme: {
    colors: {
      // A water-industry blue, deliberately distinct from River Rangers'
      // own green (proving partner-level and Story-World-level theme
      // layers are independent, not the same palette applied twice).
      brand: "#0f6e8c",
      brandDark: "#0a4f66",
      // Deliberately set equal to `brand` above — an invalid override
      // (button-label-on-button-colour with zero contrast) included on
      // purpose to exercise lib/theme/contrast.ts's rejection path. See
      // the Phase 2 report for the verified outcome (rejected, falls
      // back to the inherited default) — this is a validation fixture,
      // not a mistake to "fix".
      onBrand: "#0f6e8c",
    },
  },
  brandingTier: "co-branded",
  broughtToByText: "International Water Company",
  showBroughtToBy: true,
  poweredByText: "Powered by Moral Tree Media",
  showPoweredBy: true,
  footerCopy:
    "Test/development partner configuration. International Water " +
    "Company is a fictional organisation created for Moral Tree Media " +
    "platform architecture validation — it is not a real company, " +
    "customer, commercial partner, sponsor, or endorsement.",
  supportContact: { email: "test-fixture@example.invalid" },
  permittedStoryWorlds: [riverRangersStoryWorld],
  // Phase 4 — a test-only domain mapping, proving the custom-domain
  // *configuration model* resolves to a stable partner identity (see
  // repository/types.ts#DomainMapping). ".test" is an IANA-reserved,
  // never-resolvable TLD (RFC 2606), same rationale as the
  // ".invalid" email above — this is not a real, ownable domain and
  // is not wired into any request-routing path (see the Phase 4
  // report's custom-domain section).
  customDomains: [
    { domain: "stories.internationalwater.test", verified: true },
  ],
  status: "active",
  internalNotes:
    "FICTIONAL / TEST-ONLY. Created solely for Phase 2 architecture " +
    "validation of the Partner/Tenant system. Do not treat as a real " +
    "company, customer, commercial partner, sponsorship, or endorsement " +
    "of any kind. Not for public use. Logo/colours/wording are " +
    "placeholder test configuration only. `permittedStoryWorlds` is " +
    "restricted to River Rangers on purpose — see " +
    "sanity/queries.ts#getCampaignForRoute's isolation check.",
};

// --- Test campaign: River Rangers × International Water Company ------------
//
// One development campaign through the shared campaign system — no
// bespoke route or component. `key` is intentionally a different shape
// from `slug` (not just a copy of it) to make the two-identifier model
// visible, not just theoretically true.

export const riverRangersWaterSafetyCampaign: CampaignDoc = {
  _id: "dev-campaign-river-rangers-water-safety",
  title: "River Rangers — Water Safety",
  key: "rr-watersafety-iwc-dev01",
  slug: { current: "river-rangers-water-safety" },
  partner: internationalWaterCompanyPartner,
  storyWorld: riverRangersStoryWorld,
  theme: {
    colors: {
      // Campaign-level override — the most specific layer in the chain.
      // A distinct deep amber, checked by hand against the Story
      // World's `surface` (~3.8:1, clears the 3:1 minimum) — different
      // from both the Story World's own accentGold (#8a6a2e) and the
      // partner's blue, so a resolved page can be checked against all
      // three without ambiguity about which layer supplied which colour.
      accentGold: "#a5721f",
    },
  },
  offer: {
    trialLengthDays: 30,
    // No Stripe Price — see the Phase 2 report's Stripe section. This
    // field stays unset deliberately; nothing in this phase creates or
    // references a real or test Stripe object.
  },
  headline: "Water safety adventures with the River Rangers.",
  subheadline:
    "PROVISIONAL — a development campaign exploring safe, confident, " +
    "caring behaviour around rivers and water.",
  ctaWording: "Start Tonight — Free for 30 Nights",
  supportingCopyOverride:
    "PROVISIONAL development copy — bedtime stories that help children " +
    "learn to enjoy rivers and water safely, alongside Benny, Barney, " +
    "Coco, Boomer, and their River Ranger friends.",
  sectionOverrides: [],
  status: "active",
  trackingIdentifiers: {
    internalCode: "river-rangers-water-safety-dev",
    defaultUtm: {
      source: "international-water-company",
      medium: "partner-site",
      campaign: "water-safety-2026",
    },
  },
  acquisitionSources: [
    {
      label: "International Water Company site banner (test)",
      channelType: "partner-site",
      code: "iwc-banner",
      active: true,
    },
    {
      label: "Water safety poster QR (test)",
      channelType: "qr",
      code: "water-safety-poster",
      // Reserves the /s/[shortCode] redirect target for when that
      // route is built (architecture proposal §8) — not resolvable yet.
      shortCode: "rr-watersafety-poster",
      active: true,
    },
  ],
  internalNotes:
    "TEST/DEVELOPMENT CAMPAIGN — Phase 2 architecture validation only. " +
    "Headline, body copy, CTA, and the 30-night offer are development " +
    "placeholders, not approved marketing copy, and no real trial is " +
    "provisioned (see lib/platform/contract.ts). Do not launch publicly " +
    "or treat as a real campaign without explicit approval.",
};

// --- Phase 4 lifecycle/collision test fixtures ------------------------------
// Synthetic-only — these three exist purely to exercise
// lib/campaignRules.ts's lifecycle resolution and
// lib/sanity/queries.ts#getCampaignByShortCode's collision handling in a
// committed, repeatable test (see lib/sanity/queries.test.ts), not as
// real or plausible campaigns. None of them is referenced by any real
// short link or route. Reuse River Rangers/International Water Company
// as their Story World/Partner purely for convenience (any Story World
// would do) — this does not extend either's own real/provisional status
// in any way.

/** Stored `status: "paused"` — an admin override that wins regardless
 * of dates (see resolveCampaignLifecycleStatus's doc comment). */
export const pausedTestCampaign: CampaignDoc = {
  _id: "dev-campaign-test-paused",
  title: "[TEST] Paused campaign fixture",
  key: "test-paused-campaign-dev01",
  slug: { current: "test-paused" },
  partner: internationalWaterCompanyPartner,
  storyWorld: riverRangersStoryWorld,
  status: "paused",
  // Phase 5 — exercises /campaign-unavailable's per-campaign override
  // path (falls back to the generic "paused" copy when unset, as every
  // other test fixture below does).
  unavailableMessage:
    "[TEST] This custom message proves the per-campaign override path, " +
    "not the generic paused copy.",
  acquisitionSources: [
    {
      label: "[TEST] paused campaign short code",
      channelType: "qr",
      code: "test-paused",
      shortCode: "test-paused-poster",
      active: true,
    },
  ],
  internalNotes:
    "TEST FIXTURE ONLY — exists solely to verify that a paused " +
    "campaign's short code resolves to `inactive`, not `active` or a " +
    "fabricated live page. Never a real campaign.",
};

/** Stored `status: "active"` with an `endDate` in the past — must
 * resolve to the *computed* `expired` lifecycle status, never to
 * `active`, with no admin having to touch the stored field. */
export const expiredTestCampaign: CampaignDoc = {
  _id: "dev-campaign-test-expired",
  title: "[TEST] Expired campaign fixture",
  key: "test-expired-campaign-dev01",
  slug: { current: "test-expired" },
  partner: internationalWaterCompanyPartner,
  storyWorld: riverRangersStoryWorld,
  status: "active",
  startDate: "2020-01-01T00:00:00.000Z",
  endDate: "2020-02-01T00:00:00.000Z",
  acquisitionSources: [
    {
      label: "[TEST] expired campaign short code",
      channelType: "qr",
      code: "test-expired",
      shortCode: "test-expired-poster",
      active: true,
    },
  ],
  internalNotes:
    "TEST FIXTURE ONLY — a campaign stored as active whose end date is " +
    "long past, verifying request-time expiry resolution needs no " +
    "background job to flip the stored status. Never a real campaign.",
};

/** Stored `status: "active"` with a `startDate` far in the future —
 * must resolve to the *computed* `scheduled` lifecycle status (Phase 5:
 * "future/scheduled campaign → safe unavailable/not-yet-active
 * behaviour"), never to `active`. */
export const scheduledTestCampaign: CampaignDoc = {
  _id: "dev-campaign-test-scheduled",
  title: "[TEST] Scheduled campaign fixture",
  key: "test-scheduled-campaign-dev01",
  slug: { current: "test-scheduled" },
  partner: internationalWaterCompanyPartner,
  storyWorld: riverRangersStoryWorld,
  status: "active",
  startDate: "2999-01-01T00:00:00.000Z",
  acquisitionSources: [
    {
      label: "[TEST] scheduled campaign short code",
      channelType: "qr",
      code: "test-scheduled",
      shortCode: "test-scheduled-poster",
      active: true,
    },
  ],
  internalNotes:
    "TEST FIXTURE ONLY — a campaign stored as active whose start date " +
    "is far in the future, verifying it resolves as not-yet-live " +
    "rather than active. Never a real campaign.",
};

/** Stored `status: "archived"` — a permanent admin retirement, distinct
 * from `paused` (temporary) — see StoredCampaignStatus's doc comment. */
export const archivedTestCampaign: CampaignDoc = {
  _id: "dev-campaign-test-archived",
  title: "[TEST] Archived campaign fixture",
  key: "test-archived-campaign-dev01",
  slug: { current: "test-archived" },
  partner: internationalWaterCompanyPartner,
  storyWorld: riverRangersStoryWorld,
  status: "archived",
  acquisitionSources: [
    {
      label: "[TEST] archived campaign short code",
      channelType: "qr",
      code: "test-archived",
      shortCode: "test-archived-poster",
      active: true,
    },
  ],
  internalNotes:
    "TEST FIXTURE ONLY — verifies an archived campaign's short code " +
    "resolves to inactive/unavailable, distinct from paused. Never a " +
    "real campaign.",
};

/** An otherwise-active campaign whose *specific acquisition source* is
 * individually deactivated (`active: false`) — must resolve as
 * `inactive` with `reason: "source-disabled"`, not conflated with the
 * campaign's own (still-`active`) lifecycle status. */
export const disabledSourceTestCampaign: CampaignDoc = {
  _id: "dev-campaign-test-disabled-source",
  title: "[TEST] Disabled acquisition source fixture",
  key: "test-disabled-source-campaign-dev01",
  slug: { current: "test-disabled-source" },
  partner: internationalWaterCompanyPartner,
  storyWorld: riverRangersStoryWorld,
  status: "active",
  acquisitionSources: [
    {
      label: "[TEST] individually deactivated placement",
      channelType: "qr",
      code: "test-disabled-source",
      shortCode: "test-disabled-source-poster",
      active: false,
    },
  ],
  internalNotes:
    "TEST FIXTURE ONLY — the campaign itself is active; only this one " +
    "placement is turned off. Verifies the two causes of " +
    "unavailability are reported distinctly. Never a real campaign.",
};

/**
 * Two campaigns whose acquisition sources deliberately share one short
 * code (`"test-collision"`) — verifies `getCampaignByShortCode` fails
 * closed (`{status: "collision"}`) rather than nondeterministically
 * picking one, per "short-code collisions are rejected" (Phase 4 brief).
 * A real Sanity deployment would reject this at authoring time (see
 * acquisitionSource.ts's uniqueness validation) — these two prove the
 * read-time guard that catches it anyway, e.g. for data that reached
 * this repository some other way.
 */
export const collisionTestCampaignA: CampaignDoc = {
  _id: "dev-campaign-test-collision-a",
  title: "[TEST] Collision fixture A",
  key: "test-collision-campaign-a-dev01",
  slug: { current: "test-collision-a" },
  storyWorld: riverRangersStoryWorld,
  status: "active",
  acquisitionSources: [
    {
      label: "[TEST] colliding short code (A)",
      channelType: "qr",
      code: "test-collision-a",
      shortCode: "test-collision",
      active: true,
    },
  ],
  internalNotes:
    "TEST FIXTURE ONLY — deliberately shares a shortCode with " +
    "collisionTestCampaignB to verify collision detection. Never a " +
    "real campaign.",
};

export const collisionTestCampaignB: CampaignDoc = {
  _id: "dev-campaign-test-collision-b",
  title: "[TEST] Collision fixture B",
  key: "test-collision-campaign-b-dev01",
  slug: { current: "test-collision-b" },
  storyWorld: riverRangersStoryWorld,
  status: "active",
  acquisitionSources: [
    {
      label: "[TEST] colliding short code (B)",
      channelType: "qr",
      code: "test-collision-b",
      shortCode: "test-collision",
      active: true,
    },
  ],
  internalNotes:
    "TEST FIXTURE ONLY — deliberately shares a shortCode with " +
    "collisionTestCampaignA to verify collision detection. Never a " +
    "real campaign.",
};

/** Searched by `sanity/queries.ts`'s mock fallback, merged alongside
 * `mockContent.ts#mockCampaigns` (the two stay separate arrays in their
 * own files; only the search is combined). */
export const devCampaigns: CampaignDoc[] = [
  riverRangersWaterSafetyCampaign,
  pausedTestCampaign,
  expiredTestCampaign,
  scheduledTestCampaign,
  archivedTestCampaign,
  disabledSourceTestCampaign,
  collisionTestCampaignA,
  collisionTestCampaignB,
];

/** Same pattern as `devCampaigns` — merged into `mockContent.ts`'s own
 * arrays by `sanity/queries.ts#getPartnerByKey`/`getStoryWorldByKey`. */
export const devPartners: PartnerDoc[] = [internationalWaterCompanyPartner];
export const devStoryWorlds: StoryWorldDoc[] = [riverRangersStoryWorld];
