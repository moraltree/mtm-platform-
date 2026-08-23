import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Hero } from "@/components/patterns/Hero";
import { CtaPanel } from "@/components/patterns/CtaPanel";
import { PageSections } from "@/components/patterns/PageSections";
import { getPageByPageId } from "@/lib/sanity/queries";
import { adaptSections } from "@/lib/pageSections";
import { buildMetadata } from "@/lib/metadata";
import { cx } from "@/lib/cx";
import styles from "./about.module.css";

// About used to share `lib/editorialPage.tsx` (404-on-missing-doc, see
// CLAUDE.md's null-handling rule 1) — same category as Founder/Mission,
// which still use it. Owner decision (24 Aug 2026 refinement sprint):
// About specifically moves to real, hand-authored positioning copy
// instead, the same "no page doc yet, so a real page built from
// hand-authored (not fabricated) copy" precedent Home's own null-state
// established — About is a primary nav item real visitors reach
// constantly, not unpublished editorial content with no honest fallback.
// A real Sanity `page` document, once one exists, still wins immediately
// — nothing to migrate by hand. Founder/Mission are deliberately
// untouched: they still have no honest non-fabricated fallback (a
// specific person's bio, a mission statement no one has actually
// written), unlike About's positioning copy here.

const PILLARS = [
  "Publishing",
  "Bedtime audio",
  "Animation",
  "Physical products",
  "QR-enabled experiences",
  "Interactive media",
  "Partnerships",
];

const GROWTH_STAGES = [
  {
    title: "Books",
    body: "Physical, story-first children's books — where every Story World starts.",
  },
  {
    title: "Audiobooks",
    body: "The same stories, narrated for bedtime — a second way to spend time with the same characters.",
  },
  {
    title: "Animation",
    body: "Short clips bringing a Story World's characters to life in motion, connected back to the books.",
  },
  {
    title: "Interactive experiences",
    body: "QR-triggered scenes, digital extras, and future interactive media that connect the physical and digital sides of a Story World.",
  },
];

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageByPageId("about");
  return buildMetadata(
    page?.seo?.metaTitle || page?.title || "About",
    page?.seo,
  );
}

export default async function AboutPage() {
  const page = await getPageByPageId("about");

  if (page) {
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

  return (
    <>
      <Hero
        eyebrow="Moral Tree Media"
        heading="Stories that help children become great citizens of the world."
        media={{
          src: "/images/brand/moral-tree-mark.png",
          alt: "The Moral Tree — Moral Tree Media's symbol",
        }}
        ctas={[
          { label: "Explore Story Worlds", href: "/story-worlds" },
          { label: "Start your 30-day free trial", href: "/free30" },
        ]}
      />

      <section className={styles.section}>
        <Container>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionHeading}>What is Moral Tree Media?</h2>
            <p className={styles.sectionBody}>
              Moral Tree Media develops scalable children&rsquo;s Story Worlds —
              characters, settings, and themes designed to grow across every
              medium a family might reach for. Moral Tree Media itself sits
              above any single Story World: it&rsquo;s the company building the
              publishing, audio, animation, and experience infrastructure that
              every Story World shares, starting with our first, Zulu the Zebra
              &amp; The Savannah Seven.
            </p>
          </div>
          <ul className={styles.pillarList}>
            {PILLARS.map((pillar) => (
              <li key={pillar} className={styles.pillarItem}>
                {pillar}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className={cx(styles.section, styles.sectionSubtle)}>
        <Container>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionHeading}>Our purpose</h2>
            <p className={styles.sectionBody}>
              We build children&rsquo;s media around kindness, equality,
              inclusion, and respect for difference — stories with a moral
              centre, not just a plot. That&rsquo;s the standard every Story
              World is held to, whatever form it takes.
            </p>
            <p className={styles.sectionBody}>
              Longer term, we want that purpose to reach beyond the stories
              themselves. A future charitable initiative connected to the
              Savannah Seven is part of our ambition — a development project
              we&rsquo;re working toward, not a registered charity today.
            </p>
          </div>
        </Container>
      </section>

      <section className={styles.section}>
        <Container>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionHeading}>How our stories grow</h2>
            <p className={styles.sectionBody}>
              Every Story World follows the same path, one medium building on
              the last.
            </p>
          </div>
          <div className={styles.growthRow}>
            {GROWTH_STAGES.map((stage, index) => (
              <div key={stage.title} className={styles.growthStep}>
                <div className={styles.growthCard}>
                  <h3 className={styles.growthTitle}>{stage.title}</h3>
                  <p className={styles.growthBody}>{stage.body}</p>
                </div>
                {index < GROWTH_STAGES.length - 1 && (
                  <span className={styles.growthArrow} aria-hidden="true">
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className={cx(styles.section, styles.sectionSubtle)}>
        <Container>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionHeading}>Story Worlds</h2>
            <p className={styles.sectionBody}>
              Our first Story World is Zulu the Zebra &amp; The Savannah Seven —
              Zulu and his circle of friends, in development now across books,
              audio, and animation. Further Story Worlds will follow as each one
              develops.
            </p>
          </div>
        </Container>
      </section>

      <CtaPanel
        heading="Get involved with Moral Tree Media"
        body="Explore our first Story World, try 30 nights free, or get in touch if you're exploring a partnership."
        cta={{ label: "Start your 30-day free trial", href: "/free30" }}
        tone="primary"
      />

      <section className={styles.section}>
        <Container className={styles.sectionLinks}>
          <Button href="/story-worlds" variant="secondary">
            Explore Story Worlds
          </Button>
          <Button href="/contact" variant="ghost">
            Contact Moral Tree Media
          </Button>
        </Container>
      </section>
    </>
  );
}
