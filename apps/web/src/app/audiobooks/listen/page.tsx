import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { AudiobookExperience } from "@/components/audiobooks";
import { getPublishedAudiobookCatalogue } from "@/lib/audiobooks/catalogue";
import { buildMetadata } from "@/lib/metadata";
import styles from "./listen.module.css";

/**
 * `/audiobooks/listen` — the customer-facing audiobook carousel/player
 * (first integration of the approved prototype).
 *
 * A Server Component: it fetches the published-only catalogue and renders
 * the static chrome (page heading, section nav, preview notice); only
 * `AudiobookExperience` is a client component, since playback, the
 * carousel, and browser-local progress genuinely need the browser.
 *
 * Deliberately a sub-route rather than a replacement for `/audiobooks`
 * itself: that page's honest "audio production hasn't started" shell
 * stays as-is until real approved stories and audio exist, and this
 * route is `noindex` while it renders temporary test content. Nothing
 * links here yet — it's for review.
 */

const SECTION_LINKS = [
  { href: "#story-worlds", label: "Story Worlds" },
  { href: "#my-library", label: "My Library" },
  { href: "#continue-listening", label: "Continue Listening" },
  { href: "#parent-area", label: "Parent Area" },
];

export async function generateMetadata(): Promise<Metadata> {
  const catalogue = await getPublishedAudiobookCatalogue();
  return buildMetadata("Listen — Audiobooks", {
    noIndex: catalogue.isTestContent,
  });
}

export default async function AudiobooksListenPage() {
  const catalogue = await getPublishedAudiobookCatalogue();

  return (
    <div className={styles.page}>
      <Container>
        <div className={styles.topBar}>
          <h1 className={styles.heading}>Audiobooks</h1>
          <nav aria-label="Audiobook sections" className={styles.sectionNav}>
            <ul className={styles.sectionList}>
              {SECTION_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className={styles.sectionLink}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {catalogue.isTestContent && (
          <p className={styles.previewNotice} role="note">
            <strong>Preview:</strong> temporary test stories for design review —
            titles, artwork pairings and audio are placeholders, not published
            content.
          </p>
        )}

        <AudiobookExperience catalogue={catalogue} />
      </Container>
    </div>
  );
}
