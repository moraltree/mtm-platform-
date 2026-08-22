import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { Fraunces } from "next/font/google";
import { Container } from "@/components/ui/Container";
import { CHARACTER_GROUPS } from "@/lib/characterGroups";
import { cx } from "@/lib/cx";
import type { PartnerId, StoryWorldId } from "@/lib/platform/ids";
import { SignupForm, type SignupFormOfferHints } from "./SignupForm";
import { CampaignLandingAnalytics } from "./CampaignLandingAnalytics";
import { HeroCastCluster, type HeroCastMember } from "./HeroCastCluster";
import type { FreeTrialSignupState } from "./actions";
import {
  MoonIcon,
  AudiobookIcon,
  FamilyIcon,
  BedIcon,
  PhoneIcon,
  TabletIcon,
  SpeakerIcon,
  ShieldIcon,
} from "./campaign-icons";
import styles from "./CampaignLanding.module.css";

// Headline-only display serif — warmer and more distinctive than the
// site-wide Geist Sans (layout.tsx), scoped to this page's .kicker only
// (body copy/form/tagline stay sans-serif, per the brief). Fraunces was
// picked specifically for its soft, warm optical-size design (not a
// stiff editorial serif like Playfair, not a playful nursery face) —
// premium-storybook rather than corporate or cartoonish.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["600", "700"],
  style: ["normal"],
  variable: "--font-campaign-headline",
});

export interface CampaignLandingContent {
  eyebrow: string;
  kicker: string;
  tagline: string;
  description: string;
  ctaLabel: string;
}

/**
 * Generic, data-driven Story World content — the Phase 1 replacement for
 * importing `lib/characters.ts`/`lib/characterGroups.ts` directly (see
 * this file's own history: those manifests were Zulu/Savannah-Seven-
 * specific and hard-coded into this otherwise-generic component, exactly
 * what the platform brief says not to do). Sourced from a Sanity
 * `storyWorld` document's `characterRoster`/`campaignDefaults` fields
 * (apps/studio/schemaTypes/documents/storyWorld.ts) via the
 * `/start/[storyWorld]/[campaign]` route — see that route's own
 * doc comment for how it's assembled.
 *
 * Deliberately absent when rendering `/free30` — that route still calls
 * this component with no `storyWorld` prop at all, which is what keeps
 * every hard-coded Zulu default below in effect for it, unchanged.
 */
export interface GenericStoryWorldContent {
  title: string;
  characterRoster?: Array<{
    name: string;
    portraitUrl?: string;
    portraitAlt?: string;
  }>;
  campaignDefaults?: {
    headline?: string;
    supportingCopy?: string;
    ctaLabel?: string;
    benefits?: string[];
    trustCopy?: string;
  };
}

/** Matches `Campaign.sectionOverrides`' option list in Sanity — sections
 * a Campaign can suppress. "offer" has no current section to map to
 * (the hero's own signup form *is* the offer, and isn't suppressible —
 * hiding the primary CTA would defeat the page's purpose); the option
 * stays reserved in Sanity for a future dedicated offer panel. */
export type SuppressibleSection = "benefits" | "storyWorldIntro" | "trust";

export interface CampaignLandingProps {
  /** Route slug this page lives at (e.g. "free30") — travels into the
   * signup Server Action as the `campaign` field. Must also be listed in
   * `lib/campaignRoutes.ts#CAMPAIGN_ROUTE_SLUGS` so the corporate
   * Header/Footer stay suppressed on this route (CorporateChromeGate). */
  campaign: string;
  /** Free-text traffic identifier from the incoming URL (e.g.
   * `?src=poster-blackpool`) — travels alongside `campaign` into the
   * signup action, so a later analytics integration has real per-source
   * data from day one rather than something bolted on afterward. */
  source?: string;
  /** Every field defaults to the `/free30` copy below unless `storyWorld`
   * is also provided (see that prop) — a future campaign route can
   * override any subset while reusing everything else. */
  content?: Partial<CampaignLandingContent>;
  /** When provided (the generic `/start/...` route), this component
   * renders from this Story World's own data instead of the hard-coded
   * Zulu/Savannah-Seven content below — see this type's own doc comment.
   * Left `undefined` by `/free30`, which is what preserves its exact
   * existing rendering. */
  storyWorld?: GenericStoryWorldContent;
  /** Section keys to hide — see `SuppressibleSection`. Ignored (nothing
   * hidden) when omitted, exactly `/free30`'s existing behaviour. */
  sectionOverrides?: SuppressibleSection[];
  /** Resolved theme, as inline CSS custom properties (see
   * `lib/theme/resolveTheme.ts#themeToCssVariables`'s doc comment) —
   * applied to the page root, where it re-declares the same core
   * colour-token names the whole design system (this stylesheet, and
   * shared primitives like `Button`) already reads, scoped to this
   * page's subtree only. `/free30` never passes this, so nothing is
   * re-declared there and it renders against the untouched `:root`
   * values exactly as before. */
  themeStyle?: CSSProperties;
  /** Overrides the default `/free30` signup Server Action + its initial
   * state — the generic `/start/...` route supplies its own,
   * attribution-aware action instead (see that route's `actions.ts`).
   * Defaults preserve `/free30`'s exact existing behaviour. */
  signupAction?: (
    prevState: FreeTrialSignupState,
    formData: FormData,
  ) => Promise<FreeTrialSignupState>;
  signupInitialState?: FreeTrialSignupState;
  /** Threaded straight through to both `SignupForm` instances as hidden
   * fields — see `SignupFormProps`' own doc comments. `/free30` passes
   * none of these (no Sanity-backed Campaign document exists for it). */
  partnerId?: PartnerId;
  storyWorldId?: StoryWorldId;
  offer?: SignupFormOfferHints;
  knownCountry?: string;
}

const DEFAULT_CONTENT: CampaignLandingContent = {
  eyebrow: "Moral Tree Media",
  kicker: "30 Nights Free Trial",
  tagline: "Make bedtime the perfect end to their day.",
  description:
    "Thirty nights of calming, screen-free bedtime stories to help children relax, dream, and drift off peacefully.",
  ctaLabel: "START TONIGHT — FREE FOR 30 NIGHTS",
};

/** Generic-mode fallback — used only when `storyWorld` is provided and
 * neither it nor `content` sets a given field. Deliberately NOT
 * Zulu-flavoured (unlike `DEFAULT_CONTENT` above): a Story World this
 * component has never seen before must not default to "30 Nights Free
 * Trial" copy that implies a specific, different product. */
const GENERIC_DEFAULT_CONTENT: CampaignLandingContent = {
  eyebrow: "Moral Tree Media",
  kicker: "Start your free trial",
  tagline: "Bedtime stories worth staying up for.",
  description: "Screen-free audio stories, ready whenever bedtime is.",
  ctaLabel: "START FREE TRIAL",
};

const GENERIC_BENEFIT_ICONS = [MoonIcon, AudiobookIcon, FamilyIcon, BedIcon];

const BENEFITS = [
  { Icon: MoonIcon, label: "Calm, screen-free listening" },
  { Icon: AudiobookIcon, label: "A new audiobook every night" },
  { Icon: FamilyIcon, label: "Quality family time together" },
  { Icon: BedIcon, label: "Designed for peaceful bedtimes" },
];

const DEVICES = [
  { Icon: PhoneIcon, label: "Phone" },
  { Icon: TabletIcon, label: "Tablet" },
  { Icon: SpeakerIcon, label: "Smart speaker" },
];

// Cast section (below the fold) still uses the full-cast "storytime
// circle" group photo — untouched by this pass, see
// lib/characterGroups.ts. The hero's own left/right imagery, below, was
// reworked away from the other two full-cast photos this manifest once
// used here (group-portrait/sunset-silhouette) — see HeroCastCluster's
// doc comment for why. Only used in the legacy (no `storyWorld` prop)
// path — see the cast section's render logic below.
const CAST_IMAGE = CHARACTER_GROUPS.find((g) => g.slug === "storytime-circle")!;

// The hero's left/right flanks, split so every character appears exactly
// once across the whole hero (no duplicates) and each flank gets one
// canonically-larger "anchor" plus a mix of smaller companions — see
// lib/characters.ts#relativeScale for the approved scale this ordering
// follows: Zala (1.90) and Kofi (1.40) are the two largest, so each
// anchors one side; Nara (0.55) and Mango (0.40) — the two characters
// flagged as reading too-similar-in-size in the previous full-cast-photo
// version — land in different "small" companion slots, nowhere near
// each other, so there's no risk of them reading as the same size again.
// Legacy-path only — see the hero's render logic below.
const HERO_LEFT_CAST: HeroCastMember[] = [
  { slug: "zala", tier: "anchor", pose: "standing-full-body" },
  { slug: "rocky", tier: "medium", pose: "three-quarter-wave" },
  { slug: "nara", tier: "small", pose: "three-quarter-wave" },
  { slug: "sid", tier: "small", pose: "three-quarter-wave" },
];
const HERO_RIGHT_CAST: HeroCastMember[] = [
  { slug: "kofi", tier: "anchor", pose: "standing-full-body" },
  { slug: "zulu", tier: "medium", pose: "three-quarter-wave" },
  { slug: "lulu", tier: "medium", pose: "three-quarter-wave" },
  { slug: "mango", tier: "small", pose: "three-quarter-wave" },
];

// All eight, named — balanced representation as a simple text line under
// the group photo (see the corporate homepage's "Meet the cast" section
// for the same eight names) rather than eight more small portraits
// competing with the photo above them. Legacy-path only.
const ALL_CHARACTER_NAMES = [
  "Zulu",
  "Zala",
  "Nara",
  "Mango",
  "Lulu",
  "Sid",
  "Rocky",
  "Kofi",
];

/**
 * Shared template for every campaign/QR landing page (`/free30`, and —
 * as of Phase 1 — every campaign served through `/start/[storyWorld]/
 * [campaign]`). One objective per page: convert a visitor into the free
 * trial as fast as possible — no corporate nav (see CorporateChromeGate/
 * lib/campaignRoutes.ts), no invented testimonials/stats/claims,
 * mobile-first throughout. Light warm cream/cappuccino palette end to
 * end by default — no dark sections — matching the corporate site's
 * brand system, overridable per-field via `themeStyle` (see that prop's
 * doc comment) once a Partner/Story-World/Campaign theme resolves to
 * something other than the core defaults.
 *
 * `/free30` calls this with only `campaign`/`source`/`content` — no
 * `storyWorld`, no `sectionOverrides`, no `themeStyle`, no
 * `signupAction` — which is what keeps every hard-coded Zulu/Savannah-
 * Seven default in this file in effect for it, unchanged from before
 * Phase 1. The generic `/start/...` route supplies all of the above,
 * which is what keeps this component itself free of any Story-World-
 * specific assumption (see `GenericStoryWorldContent`'s doc comment).
 */
export function CampaignLanding({
  campaign,
  source,
  content,
  storyWorld,
  sectionOverrides = [],
  themeStyle,
  signupAction,
  signupInitialState,
  partnerId,
  storyWorldId,
  offer,
  knownCountry,
}: CampaignLandingProps) {
  const baseDefaults = storyWorld ? GENERIC_DEFAULT_CONTENT : DEFAULT_CONTENT;
  const storyWorldDefaults = storyWorld?.campaignDefaults;
  const copy: CampaignLandingContent = {
    ...baseDefaults,
    ...(storyWorldDefaults?.headline && {
      kicker: storyWorldDefaults.headline,
    }),
    ...(storyWorldDefaults?.supportingCopy && {
      description: storyWorldDefaults.supportingCopy,
    }),
    ...(storyWorldDefaults?.ctaLabel && {
      ctaLabel: storyWorldDefaults.ctaLabel,
    }),
    ...content,
  };

  const benefitsToRender = storyWorldDefaults?.benefits
    ? storyWorldDefaults.benefits.map((label, index) => ({
        Icon: GENERIC_BENEFIT_ICONS[index % GENERIC_BENEFIT_ICONS.length],
        label,
      }))
    : BENEFITS;

  const trustBody =
    storyWorldDefaults?.trustCopy ??
    "Created for families. Designed with child development in mind.";

  const hideBenefits = sectionOverrides.includes("benefits");
  const hideStoryWorldIntro = sectionOverrides.includes("storyWorldIntro");
  const hideTrust = sectionOverrides.includes("trust");

  const roster = storyWorld?.characterRoster ?? [];

  return (
    <div className={cx(styles.page, fraunces.variable)} style={themeStyle}>
      <CampaignLandingAnalytics
        campaignId={campaign}
        partnerId={partnerId}
        storyWorldId={storyWorldId}
      />
      {/* Icon + wordmark lockup, not corporate nav — the Moral Tree
          symbol itself (public/images/brand — see its README for
          provenance), not just the words "Moral Tree Media", so a QR
          visitor immediately recognises the brand rather than landing on
          what could read as an anonymous bedtime-story service. Still no
          full primary nav — CorporateChromeGate suppresses that. */}
      <div className={styles.brandBar}>
        <Container className={styles.brandBarInner}>
          <div className={styles.brandLockup}>
            <span className={styles.brandTreeIcon}>
              <Image
                src="/images/brand/moral-tree-mark.png"
                alt=""
                fill
                sizes="(min-width: 40rem) 5.25rem, 4.5rem"
              />
            </span>
            <span className={styles.brandMark}>{copy.eyebrow}</span>
          </div>
        </Container>
      </div>

      <section className={styles.hero}>
        <Container>
          <div
            className={cx(
              styles.heroGrid,
              storyWorld && styles.heroGridCentered,
            )}
          >
            {/* The tiered anchor/companion cast cluster is bespoke art
                direction for Zulu/Savannah-Seven (see HeroCastCluster's
                doc comment) — a generic Story World gets a centred hero
                instead (styles.heroGridCentered above) rather than a
                forced fit into art direction that was never made for
                its characters. */}
            {!storyWorld && (
              <>
                <div className={styles.heroImageLeft}>
                  <HeroCastCluster members={HERO_LEFT_CAST} />
                </div>
                <div className={styles.heroImageRight}>
                  <HeroCastCluster members={HERO_RIGHT_CAST} />
                </div>
              </>
            )}
            <div className={styles.heroContent}>
              <h1 className={styles.kicker}>{copy.kicker}</h1>
              <p className={styles.tagline}>{copy.tagline}</p>
              <p className={styles.description}>{copy.description}</p>

              <SignupForm
                campaign={campaign}
                source={source}
                ctaLabel={copy.ctaLabel}
                instanceId="hero"
                className={styles.heroForm}
                action={signupAction}
                initialState={signupInitialState}
                partnerId={partnerId}
                storyWorldId={storyWorldId}
                offer={offer}
                knownCountry={knownCountry}
              />
            </div>
          </div>
        </Container>
      </section>

      {!hideBenefits && (
        <section className={styles.benefits}>
          <Container>
            <h2 className={styles.benefitsHeading}>
              Why bedtime with Moral Tree Media
            </h2>
            <ul className={styles.benefitList}>
              {benefitsToRender.map(({ Icon, label }) => (
                <li key={label} className={styles.benefitItem}>
                  <span className={styles.benefitIcon}>
                    <Icon />
                  </span>
                  <span className={styles.benefitLabel}>{label}</span>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      {!hideTrust && (
        <section className={styles.trust}>
          <Container className={styles.trustInner}>
            <span className={styles.trustBadge}>
              <ShieldIcon />
            </span>
            <h2 className={styles.trustHeadline}>
              Safe. Screen-free. Family trusted.
            </h2>
            <p className={styles.trustBody}>{trustBody}</p>
            <p className={styles.deviceIntro}>
              Every story streams straight to the device you already have.
            </p>
            <ul className={styles.deviceList}>
              {DEVICES.map(({ Icon, label }) => (
                <li key={label} className={styles.deviceItem}>
                  <span className={styles.deviceIcon}>
                    <Icon />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      {!hideStoryWorldIntro && (
        <section className={styles.cast}>
          <Container className={styles.castInner}>
            {storyWorld ? (
              <>
                <h2 className={styles.castHeading}>
                  Meet the cast of {storyWorld.title}
                </h2>
                {roster.length > 0 && (
                  <div className={styles.castRosterGrid}>
                    {roster.map((member) => (
                      <div key={member.name} className={styles.castRosterItem}>
                        <div className={styles.castRosterPortrait}>
                          {member.portraitUrl && (
                            <Image
                              src={member.portraitUrl}
                              alt={member.portraitAlt ?? member.name}
                              fill
                              sizes="5rem"
                              className={styles.castRosterPortraitImage}
                            />
                          )}
                        </div>
                        <span className={styles.castRosterName}>
                          {member.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className={styles.castImageWrap}>
                  <Image
                    src={CAST_IMAGE.path}
                    alt={CAST_IMAGE.alt}
                    fill
                    sizes="(min-width: 48rem) 40rem, 90vw"
                    className={styles.castImage}
                  />
                </div>
                <h2 className={styles.castHeading}>
                  Stories inspired by Zulu the Zebra and the Savannah Seven
                </h2>
                <p className={styles.castBody}>
                  Meet the characters children will love returning to each night
                  — each story independently narrated, all part of the same
                  warm, familiar world.
                </p>
                <p className={styles.castNames}>
                  {ALL_CHARACTER_NAMES.join(" · ")}
                </p>
              </>
            )}
          </Container>
        </section>
      )}

      <section className={styles.finalCta}>
        <Container className={styles.finalCtaInner}>
          <h2 className={styles.finalCtaHeading}>
            Ready for tonight&rsquo;s story?
          </h2>
          <SignupForm
            campaign={campaign}
            source={source}
            ctaLabel={copy.ctaLabel}
            instanceId="bottom"
            action={signupAction}
            initialState={signupInitialState}
            partnerId={partnerId}
            storyWorldId={storyWorldId}
            offer={offer}
            knownCountry={knownCountry}
          />
        </Container>
      </section>

      <footer className={styles.minimalFooter}>
        <Container className={styles.minimalFooterInner}>
          <p>
            © {new Date().getFullYear()} Moral Tree Media ·{" "}
            <Link href="/legal/privacy-policy">Privacy</Link> ·{" "}
            <Link href="/legal/terms-of-use">Terms</Link>
          </p>
        </Container>
      </footer>
    </div>
  );
}
