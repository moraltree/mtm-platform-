import styles from "./PreviewBanner.module.css";

/**
 * Persistent, unmissable indicator shown whenever USE_MOCK_CONTENT=true —
 * every page rendering underneath it is placeholder/stub content, not
 * real published copy. Deliberately not dismissible: this is a safety
 * signal (see lib/mockContent.ts), not a UX nicety.
 */
export function PreviewBanner() {
  return (
    <div className={styles.banner} role="note">
      Preview data — placeholder content for visual review only, not real or
      published.
    </div>
  );
}
