import type { Metadata } from "next";
import { SkipLink } from "@/components/ui/SkipLink";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField, TextArea } from "@/components/ui/FormField";
import { Header } from "@/components/patterns/Header";
import { Footer } from "@/components/patterns/Footer";
import { Hero } from "@/components/patterns/Hero";
import { RichText } from "@/components/patterns/RichText";
import { CtaPanel } from "@/components/patterns/CtaPanel";
import { Media } from "@/components/patterns/Media";
import { Quote } from "@/components/patterns/Quote";
import { Timeline } from "@/components/patterns/Timeline";
import { Stats } from "@/components/patterns/Stats";
import { CardGrid } from "@/components/patterns/CardGrid";
import { PageSections } from "@/components/patterns/PageSections";
import type { PageSection } from "@/components/patterns/PageSections";
import styles from "./page.module.css";

// Internal-only reference page for the WP3 design system — not part of the
// Phase One sitemap, so it's excluded from search indexing.
export const metadata: Metadata = {
  title: "Style guide (internal)",
  robots: { index: false, follow: false },
};

const NAV = [
  { label: "About", href: "/about" },
  { label: "Story Worlds", href: "/story-worlds" },
  { label: "Publishing", href: "/publishing" },
  { label: "News", href: "/news" },
  { label: "Contact", href: "/contact" },
];

const SWATCHES = [
  ["--color-brand-600", "Brand"],
  ["--color-brand-100", "Brand tint"],
  ["--color-ink-900", "Text"],
  ["--color-ink-500", "Text muted"],
  ["--color-ink-300", "Border"],
  ["--color-ink-100", "Surface subtle"],
  ["--color-danger", "Danger"],
  ["--color-success", "Success"],
] as const;

const TYPE_SCALE = [
  "--text-xs",
  "--text-sm",
  "--text-base",
  "--text-md",
  "--text-lg",
  "--text-xl",
  "--text-2xl",
  "--text-3xl",
  "--text-4xl",
] as const;

const PLACEHOLDER = { src: "/placeholder.png", alt: "" };

const mockParagraph = [
  {
    _type: "block",
    _key: "b1",
    style: "normal",
    markDefs: [],
    children: [
      {
        _type: "span",
        _key: "s1",
        marks: [],
        text: "Moral Tree Media develops story worlds across publishing, audiobooks, and animation, built around a consistent ethical core that carries from the page to the screen.",
      },
    ],
  },
  {
    _type: "block",
    _key: "b2",
    style: "h3",
    markDefs: [],
    children: [
      {
        _type: "span",
        _key: "s2",
        marks: [],
        text: "A heading inside rich text",
      },
    ],
  },
  {
    _type: "block",
    _key: "b3",
    style: "normal",
    markDefs: [],
    children: [
      { _type: "span", _key: "s3", marks: [], text: "Body copy with a " },
      { _type: "span", _key: "s4", marks: ["strong"], text: "bold" },
      { _type: "span", _key: "s5", marks: [], text: " word and an " },
      { _type: "span", _key: "s6", marks: ["em"], text: "italic" },
      { _type: "span", _key: "s7", marks: [], text: " one." },
    ],
  },
];

const demoSections: PageSection[] = [
  {
    _type: "cardGridBlock",
    _key: "cards-1",
    heading: "Capabilities",
    columns: 3,
    cards: [
      {
        title: "Publishing",
        body: "Novels and serialised fiction.",
        image: PLACEHOLDER,
        href: "/publishing",
      },
      {
        title: "Audiobooks",
        body: "Full-cast audio production.",
        image: PLACEHOLDER,
        href: "/audiobooks",
      },
      {
        title: "Animation",
        body: "Series and shorts.",
        image: PLACEHOLDER,
        href: "/animation",
      },
    ],
  },
  {
    _type: "statsBlock",
    _key: "stats-1",
    heading: "By the numbers",
    stats: [
      { value: "12", label: "Story Worlds" },
      { value: "40+", label: "Titles published" },
      { value: "6", label: "Languages" },
      { value: "3", label: "Capability areas" },
    ],
  },
  { _type: "teamGridBlock", _key: "team-1" },
];

export default function StyleGuidePage() {
  return (
    <>
      <SkipLink />
      <Header siteTitle="Moral Tree Media" nav={NAV} />

      <main id="main-content" className={styles.page}>
        <Container>
          <h1>Design system style guide</h1>
          <p>
            Internal reference for WP3 — every design-system pattern, rendered
            with mock content. Not part of the public sitemap.
          </p>
        </Container>

        <Container className={styles.section}>
          <h2 className={styles.sectionTitle}>Colour</h2>
          <div className={styles.swatchGrid}>
            {SWATCHES.map(([token, label]) => (
              <div key={token} className={styles.swatch}>
                <div
                  className={styles.swatchColor}
                  style={{ background: `var(${token})` }}
                />
                <span className={styles.swatchLabel}>
                  {label}
                  <br />
                  {token}
                </span>
              </div>
            ))}
          </div>
        </Container>

        <Container className={styles.section}>
          <h2 className={styles.sectionTitle}>Type scale</h2>
          <div className={styles.typeScale}>
            {TYPE_SCALE.map((token) => (
              <div key={token} className={styles.typeScaleRow}>
                <span className={styles.typeScaleLabel}>{token}</span>
                <span style={{ fontSize: `var(${token})` }}>
                  Moral Tree Media
                </span>
              </div>
            ))}
          </div>
        </Container>

        <Container className={styles.section}>
          <h2 className={styles.sectionTitle}>Buttons</h2>
          <div className={styles.row}>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="primary" size="lg" href="/about">
              Primary link
            </Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </div>
        </Container>

        <Container className={styles.section}>
          <h2 className={styles.sectionTitle}>Card</h2>
          <div className={styles.cardDemo}>
            <Card
              title="The Last Orchard"
              body="A Story World about repair, told across three formats."
              image={PLACEHOLDER}
              href="/story-worlds/the-last-orchard"
            />
          </div>
        </Container>

        <Container className={styles.section}>
          <h2 className={styles.sectionTitle}>Form fields</h2>
          <div className={styles.formDemo}>
            <TextField label="Name" name="name" required />
            <TextField
              label="Email"
              name="email"
              type="email"
              hint="We'll only use this to reply."
              required
            />
            <TextField
              label="Email"
              name="email-error"
              type="email"
              error="Enter a valid email address."
            />
            <TextArea label="Message" name="message" required />
          </div>
        </Container>

        <div className={styles.section}>
          <Container>
            <h2 className={styles.sectionTitle}>Hero</h2>
          </Container>
          <Hero
            eyebrow="Story Worlds"
            heading="Stories with a moral centre, told across every medium"
            subheading="From first draft to animated series — one Story World, built to last."
            media={PLACEHOLDER}
            ctas={[
              { label: "Explore Story Worlds", href: "/story-worlds" },
              { label: "About us", href: "/about" },
            ]}
          />
        </div>

        <div className={styles.section}>
          <Container>
            <h2 className={styles.sectionTitle}>CTA panel</h2>
          </Container>
          <CtaPanel
            heading="Ready to license a Story World?"
            body="Talk to our publishing team about rights across formats."
            cta={{ label: "Get in touch", href: "/contact" }}
            tone="primary"
          />
          <CtaPanel
            heading="Read our latest news"
            body="Announcements, releases, and behind-the-scenes updates."
            cta={{ label: "View news", href: "/news" }}
            tone="neutral"
          />
        </div>

        <Container className={styles.section}>
          <h2 className={styles.sectionTitle}>Media</h2>
          <Media
            type="image"
            image={PLACEHOLDER}
            caption="A production still, captioned."
          />
        </Container>

        <div className={styles.section}>
          <Quote
            quote="The best stories don't tell you what to think — they show you how to feel it."
            attribution="Founder name"
            role="Founder, Moral Tree Media"
          />
        </div>

        <Container className={styles.section}>
          <h2 className={styles.sectionTitle}>Timeline</h2>
          <Timeline
            heading="Company history"
            entries={[
              {
                date: "2021",
                title: "Founded",
                body: "Moral Tree Media is established.",
              },
              {
                date: "2023",
                title: "First Story World published",
                body: "The Last Orchard launches in print.",
              },
              {
                date: "2025",
                title: "Animation studio opens",
                body: "First original animated short goes into production.",
              },
            ]}
          />
        </Container>

        <Container className={styles.section}>
          <h2 className={styles.sectionTitle}>Statistics</h2>
          <Stats
            heading="By the numbers"
            stats={[
              { value: "12", label: "Story Worlds" },
              { value: "40+", label: "Titles published" },
              { value: "6", label: "Languages" },
              { value: "3", label: "Capability areas" },
            ]}
          />
        </Container>

        <Container className={styles.section}>
          <h2 className={styles.sectionTitle}>Card grid</h2>
          <CardGrid
            columns={3}
            cards={[
              {
                title: "Publishing",
                body: "Novels and serialised fiction.",
                image: PLACEHOLDER,
                href: "/publishing",
              },
              {
                title: "Audiobooks",
                body: "Full-cast audio production.",
                image: PLACEHOLDER,
                href: "/audiobooks",
              },
              {
                title: "Animation",
                body: "Series and shorts.",
                image: PLACEHOLDER,
                href: "/animation",
              },
            ]}
          />
        </Container>

        <Container className={styles.section}>
          <h2 className={styles.sectionTitle}>Rich text</h2>
          <RichText value={mockParagraph} />
        </Container>

        <div className={styles.section}>
          <Container>
            <h2 className={styles.sectionTitle}>
              Page sections (Sanity <code>pageBuilder</code> renderer)
            </h2>
            <p>
              The last block below (<code>teamGridBlock</code>) intentionally
              renders nothing — see <code>PageSections</code>&rsquo;s doc
              comment.
            </p>
          </Container>
          <PageSections sections={demoSections} />
        </div>
      </main>

      <Footer
        siteTitle="Moral Tree Media"
        nav={[
          { label: "Privacy policy", href: "/legal/privacy-policy" },
          { label: "Terms of use", href: "/legal/terms-of-use" },
        ]}
        socialLinks={[
          { label: "X / Twitter", href: "https://x.com", external: true },
        ]}
        note="© Moral Tree Media. All rights reserved."
      />
    </>
  );
}
