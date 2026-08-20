import Image from "next/image";
import Link from "next/link";
import { Fraunces } from "next/font/google";
import { Container } from "@/components/ui/Container";
import { CHARACTER_GROUPS } from "@/lib/characterGroups";
import { cx } from "@/lib/cx";
import { SignupForm } from "./SignupForm";
import { HeroCastCluster, type HeroCastMember } from "./HeroCastCluster";
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
  /** Every field defaults to the `/free30` copy below; a future campaign
   * route (`/blackpool`, `/pampers`, `/chester-zoo` — see the module
   * doc comment) can override any subset while reusing everything else
   * (layout, signup form, trust/benefits sections, cast intro) as-is. */
  content?: Partial<CampaignLandingContent>;
}

const DEFAULT_CONTENT: CampaignLandingContent = {
  eyebrow: "Moral Tree Media",
  kicker: "30 Nights Free Trial",
  tagline: "Make bedtime the perfect end to their day.",
  description:
    "Thirty nights of calming, screen-free bedtime stories to help children relax, dream, and drift off peacefully.",
  ctaLabel: "START TONIGHT — FREE FOR 30 NIGHTS",
};

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
// doc comment for why.
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
// competing with the photo above them.
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
 * Shared template for every campaign/QR landing page (`/free30` today;
 * `/blackpool`, `/pampers`, `/chester-zoo` are the named future variants
 * — each would be a thin `app/<slug>/page.tsx` rendering this same
 * component with its own `campaign` and, if needed, `content` override,
 * exactly like `/free30/page.tsx` does). One objective per page: convert
 * a visitor into the free trial as fast as possible — no corporate nav
 * (see CorporateChromeGate/lib/campaignRoutes.ts), no invented
 * testimonials/stats/claims, mobile-first throughout. Light warm cream/
 * cappuccino palette end to end — no dark sections — matching the
 * corporate site's brand system rather than a separate dark treatment.
 */
export function CampaignLanding({
  campaign,
  source,
  content,
}: CampaignLandingProps) {
  const copy = { ...DEFAULT_CONTENT, ...content };

  return (
    <div className={cx(styles.page, fraunces.variable)}>
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
                sizes="3rem"
              />
            </span>
            <span className={styles.brandMark}>{copy.eyebrow}</span>
          </div>
        </Container>
      </div>

      <section className={styles.hero}>
        <Container>
          <div className={styles.heroGrid}>
            <div className={styles.heroImageLeft}>
              <HeroCastCluster members={HERO_LEFT_CAST} />
            </div>
            <div className={styles.heroImageRight}>
              <HeroCastCluster members={HERO_RIGHT_CAST} />
            </div>
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
              />
            </div>
          </div>
        </Container>
      </section>

      <section className={styles.benefits}>
        <Container>
          <h2 className={styles.benefitsHeading}>
            Why bedtime with Moral Tree Media
          </h2>
          <ul className={styles.benefitList}>
            {BENEFITS.map(({ Icon, label }) => (
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

      <section className={styles.trust}>
        <Container className={styles.trustInner}>
          <span className={styles.trustBadge}>
            <ShieldIcon />
          </span>
          <h2 className={styles.trustHeadline}>
            Safe. Screen-free. Family trusted.
          </h2>
          <p className={styles.trustBody}>
            Created for families. Designed with child development in mind.
          </p>
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

      <section className={styles.cast}>
        <Container className={styles.castInner}>
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
            Meet the characters children will love returning to each night —
            each story independently narrated, all part of the same warm,
            familiar world.
          </p>
          <p className={styles.castNames}>{ALL_CHARACTER_NAMES.join(" · ")}</p>
        </Container>
      </section>

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
