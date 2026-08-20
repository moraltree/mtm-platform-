import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Hero } from "@/components/patterns/Hero";
import { CtaPanel } from "@/components/patterns/CtaPanel";
import { PageSections } from "@/components/patterns/PageSections";
import { getPageByPageId } from "@/lib/sanity/queries";
import { adaptSections } from "@/lib/pageSections";
import { buildMetadata } from "@/lib/metadata";
import { cx } from "@/lib/cx";
import { getCharacterPose, getEnsembleCharacters } from "@/lib/characters";
import { BookIcon, HeadphonesIcon, FilmIcon } from "./home-icons";
import styles from "./home.module.css";

// Temporary hero image for the null-state homepage (see the "no page doc"
// branch below): Zulu's approved three-quarter-wave website pose, via the
// character asset manifest (lib/characters.ts) rather than a hardcoded
// path, so swapping this later is a one-line change (or removing it
// entirely once a real Sanity `home` page document supplies its own
// hero media). Falls back to `undefined` (Hero renders with no image,
// same as before this change) if that pose is ever missing.
const HOME_HERO_IMAGE = getCharacterPose("zulu", "three-quarter-wave");

// "Meet the cast" section, below: Zulu leads (already featured in the
// Hero above) while the other seven get equal-sized billing here, per
// the character manifest's own documented purpose for
// getEnsembleCharacters() (lib/characters.ts) — a section that
// deliberately rotates through the ensemble rather than defaulting every
// section back to Zulu. Headshot pose + canonical name only — no
// species/personality/backstory copy, since that canon doesn't exist in
// this repository yet (see lib/characters.ts's own doc comment).
const CAST_MEMBERS = getEnsembleCharacters().map((character) => ({
  character,
  pose: getCharacterPose(character.slug, "close-up-headshot"),
}));

// Home is the site's front door — unlike the pure-editorial pages, a
// missing `page` document falls back to a real, premium homepage built
// from hand-authored (not fabricated) positioning copy and clearly-marked
// placeholders, rather than a 404 or the bare one-liner this used to be.
// This is still null-handling rule 3 (CLAUDE.md): a listing/utility page
// gets a genuine generic state, not invented corporate claims. The moment
// a real Sanity `home` page document exists, this whole branch stops
// rendering in favour of that document's own `sections` below — nothing
// here needs to be torn out by hand at that point.

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageByPageId("home");
  if (!page) return {};

  // No `page.title` fallback here (unlike other routes): the default
  // "Moral Tree Media" (root layout) should stand bare on the homepage,
  // not become "Home | Moral Tree Media".
  return buildMetadata(page.seo?.metaTitle, page.seo);
}

const MEDIUMS = [
  {
    Icon: BookIcon,
    title: "Publishing",
    body: "Picture books and middle-grade fiction built to be read again, not once and shelved.",
    href: "/publishing",
  },
  {
    Icon: HeadphonesIcon,
    title: "Audiobooks",
    body: "Narrated editions that carry each Story World into the car, the bedtime routine, and beyond.",
    href: "/audiobooks",
  },
  {
    Icon: FilmIcon,
    title: "Animation",
    body: "Animated adaptations in development, extending each Story World to the screen.",
    href: "/animation",
  },
];

export default async function Home() {
  const page = await getPageByPageId("home");

  if (!page) {
    return (
      <>
        <Hero
          eyebrow="Moral Tree Media"
          heading="Story worlds with a moral centre, told across every medium."
          subheading="We build children's story worlds — and the publishing, audiobook, and animation experiences that carry them into the real world — for families who want stories that mean something."
          media={
            HOME_HERO_IMAGE
              ? { src: HOME_HERO_IMAGE.path, alt: HOME_HERO_IMAGE.alt }
              : undefined
          }
          ctas={[
            { label: "Explore Story Worlds", href: "/story-worlds" },
            { label: "Partner With Us", href: "/contact" },
          ]}
        />

        <section className={styles.section}>
          <Container>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionHeading}>
                Stories with a moral centre
              </h2>
              <p className={styles.sectionBody}>
                Moral Tree Media develops children&rsquo;s story worlds built
                around a clear moral centre — characters, settings, and themes
                designed to grow with a child, told through publishing,
                audiobooks, and animation.
              </p>
            </div>
            <div className={styles.sectionLinks}>
              <Button href="/mission" variant="secondary">
                Read our mission
              </Button>
              <Button href="/leadership" variant="ghost">
                Meet our leadership
              </Button>
            </div>
          </Container>
        </section>

        <section className={cx(styles.section, styles.sectionSubtle)}>
          <Container>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionHeading}>Story Worlds</h2>
              <p className={styles.sectionBody}>
                Every Moral Tree Media property starts as a Story World: a
                self-contained universe of characters and values that can move
                across a picture book, an audiobook, and an animated series
                without losing what makes it matter. We&rsquo;re building our
                first slate now.
              </p>
            </div>
            <div className={styles.storyWorldLayout}>
              <div className={styles.storyWorldCard}>
                <div className={styles.storyWorldMedia}>
                  <Image
                    src="/placeholder.png"
                    alt="Placeholder — final Story World artwork pending"
                    fill
                    sizes="(min-width: 64rem) 40vw, 100vw"
                  />
                  <span className={styles.storyWorldMediaBadge}>
                    <Badge tone="neutral">Placeholder artwork</Badge>
                  </span>
                </div>
                <div className={styles.storyWorldBody}>
                  <Badge tone="brand">Coming soon</Badge>
                  <h3 className={styles.storyWorldTitle}>
                    Story World reveals coming soon
                  </h3>
                  <p className={styles.storyWorldText}>
                    Setting and synopsis details are still in development and
                    will be announced here and on our Story Worlds page once
                    approved — meet the characters below in the meantime.
                  </p>
                </div>
              </div>
              <div>
                <p className={styles.sectionBody}>
                  Visit the Story Worlds page for the current catalogue as each
                  world is confirmed and published.
                </p>
                <div className={styles.sectionLinks}>
                  <Button href="/story-worlds" variant="primary">
                    Visit Story Worlds
                  </Button>
                </div>
              </div>
            </div>
          </Container>
        </section>

        <section className={styles.section}>
          <Container>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionHeading}>Meet the cast</h2>
              <p className={styles.sectionBody}>
                Zulu leads a wider circle of friends who&rsquo;ll appear
                throughout our first Story World. Here&rsquo;s who else
                you&rsquo;ll be meeting.
              </p>
            </div>
            <ul className={styles.castGrid}>
              {CAST_MEMBERS.map(({ character, pose }) => (
                <li key={character.slug} className={styles.castMember}>
                  {pose && (
                    <div className={styles.castPortrait}>
                      <Image
                        src={pose.path}
                        alt={pose.alt}
                        fill
                        sizes="8rem"
                        className={styles.castImage}
                      />
                    </div>
                  )}
                  <p className={styles.castName}>{character.canonicalName}</p>
                </li>
              ))}
            </ul>
          </Container>
        </section>

        <section className={cx(styles.section, styles.sectionSubtle)}>
          <Container>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionHeading}>
                How our stories reach families
              </h2>
              <p className={styles.sectionBody}>
                One Story World, three ways to experience it.
              </p>
            </div>
            <div className={styles.pillarGrid}>
              {MEDIUMS.map(({ Icon, title, body, href }) => (
                <Link key={href} href={href} className={styles.pillarCard}>
                  <span className={styles.pillarIcon}>
                    <Icon />
                  </span>
                  <h3 className={styles.pillarTitle}>{title}</h3>
                  <p className={styles.pillarText}>{body}</p>
                  <span className={styles.pillarLink}>Explore {title} →</span>
                </Link>
              ))}
            </div>
          </Container>
        </section>

        <CtaPanel
          heading="Partner with Moral Tree Media"
          body="We're building relationships with publishers, licensors, retailers, and media partners who share our commitment to story worlds with a moral centre. If you're exploring a publishing, licensing, or investment opportunity, we'd like to hear from you."
          cta={{ label: "Start a conversation", href: "/contact" }}
          tone="primary"
        />

        <section className={cx(styles.section, styles.sectionSubtle)}>
          <Container>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionHeading}>For parents &amp; press</h2>
              <p className={styles.sectionBody}>
                Learn more about our mission and the team behind Moral Tree
                Media, or catch up on the latest news.
              </p>
            </div>
            <div className={styles.linksRow}>
              <Button href="/about" variant="secondary">
                About Moral Tree Media
              </Button>
              <Button href="/news" variant="secondary">
                Latest news
              </Button>
            </div>
          </Container>
        </section>
      </>
    );
  }

  const sections = adaptSections(page.sections);
  const opensWithHero = sections[0]?._type === "heroBlock";

  return (
    <>
      {!opensWithHero && (
        <Container>
          <h1>{page.title}</h1>
        </Container>
      )}
      <PageSections sections={sections} />
    </>
  );
}
