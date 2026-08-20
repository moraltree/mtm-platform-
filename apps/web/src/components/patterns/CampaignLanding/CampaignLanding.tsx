import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import {
  getLeadCharacter,
  getCharacterPose,
  getEnsembleCharacters,
} from "@/lib/characters";
import { SignupForm } from "./SignupForm";
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
  kicker: "30 Free Bedtime Stories",
  tagline: "The End To A Perfect Day",
  description:
    "Magical bedtime audiobooks designed to help children relax, dream and drift off peacefully.",
  ctaLabel: "START TONIGHT — FREE FOR 30 DAYS",
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

// Introduced modestly, lower on the page, per the brief — the lead plus
// two of the ensemble (not the full eight), so this stays a supporting
// beat rather than competing with the conversion message above the fold.
// Reuses the same already-approved character manifest/assets as the
// corporate homepage's "Meet the cast" section — no new imagery.
const lead = getLeadCharacter();
const castPreview = [lead, ...getEnsembleCharacters().slice(0, 2)].map(
  (character) => ({
    character,
    pose: getCharacterPose(character.slug, "playful-tilt"),
  }),
);

/**
 * Shared template for every campaign/QR landing page (`/free30` today;
 * `/blackpool`, `/pampers`, `/chester-zoo` are the named future variants
 * — each would be a thin `app/<slug>/page.tsx` rendering this same
 * component with its own `campaign` and, if needed, `content` override,
 * exactly like `/free30/page.tsx` does). One objective per page: convert
 * a visitor into the free trial as fast as possible — no corporate nav
 * (see CorporateChromeGate/lib/campaignRoutes.ts), no invented
 * testimonials/stats/claims, mobile-first throughout.
 */
export function CampaignLanding({
  campaign,
  source,
  content,
}: CampaignLandingProps) {
  const copy = { ...DEFAULT_CONTENT, ...content };

  return (
    <div className={styles.page}>
      {/* Minimal brand mark, not corporate nav — a single non-navigating
          wordmark so the page still reads as genuinely Moral Tree Media
          (the brief's "family trusted" claim needs a visible brand),
          without the full primary nav CorporateChromeGate suppresses. */}
      <div className={styles.brandBar}>
        <Container className={styles.brandBarInner}>
          <span className={styles.brandMark}>{copy.eyebrow}</span>
        </Container>
      </div>

      <section className={styles.hero}>
        <Container className={styles.heroInner}>
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
          <h2 className={styles.castHeading}>
            Narrated by Zulu and his circle of friends
          </h2>
          <p className={styles.castBody}>
            Every bedtime story comes from Moral Tree Media&rsquo;s first Story
            World — a cast your child will look forward to seeing again each
            night.
          </p>
          <ul className={styles.castRow}>
            {castPreview.map(({ character, pose }) => (
              <li key={character.slug} className={styles.castMember}>
                {pose && (
                  <div className={styles.castPortrait}>
                    <Image
                      src={pose.path}
                      alt={pose.alt}
                      fill
                      sizes="4.5rem"
                      className={styles.castImage}
                    />
                  </div>
                )}
                <span className={styles.castName}>
                  {character.canonicalName}
                </span>
              </li>
            ))}
          </ul>
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
