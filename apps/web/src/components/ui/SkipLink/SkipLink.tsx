import styles from "./SkipLink.module.css";

/**
 * WCAG 2.4.1 bypass block. Hidden until keyboard-focused. The root layout
 * (WP4) must give the main landmark `id="main-content"` for this to work.
 */
export function SkipLink() {
  return (
    <a href="#main-content" className={styles.skipLink}>
      Skip to main content
    </a>
  );
}
