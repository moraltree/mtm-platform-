import Image from "next/image";
import { cx } from "@/lib/cx";
import styles from "./BrandMark.module.css";

/**
 * The one standardised "Moral Tree Media" branding visual for corporate/
 * utility pages (News, Contact — 24 Aug 2026 refinement sprint) —
 * previously each page built its own ad hoc treatment of
 * `public/images/brand/moral-tree-mark.png` (a circular-cropped badge on
 * News, a mismatched portrait-ratio box on Contact), both of which
 * shrank the mark far more than intended: the source PNG is landscape
 * (1216x848, ratio ~1.43), and forcing it into a portrait or square box
 * with `object-fit: contain` left large empty margins top/bottom — the
 * literal "too small" symptom this sprint's brief reported, not a
 * subjective framing preference. This component's own box (`3 / 2`,
 * ratio 1.5) is a close match to the real ratio, so `contain` needs
 * almost no letterboxing either way. Not a circular crop (the brief is
 * explicit: "do not use a cropped circular Moral Tree icon") — a plain
 * rounded-rect card — and always paired with an explicit "Moral Tree
 * Media" wordmark underneath, since the mark image itself has no text
 * baked in (see public/images/brand/README.md).
 *
 * Deliberately NOT used by the campaign-funnel brand bar
 * (CampaignLanding.tsx) or the corporate site's own primary nav — both
 * are separate, already-reviewed treatments outside this sprint's scope
 * (a small icon+text lockup and plain text respectively, neither
 * exhibiting this bug since neither forces the mark into a mismatched
 * aspect-ratio box).
 */

export interface BrandMarkProps {
  className?: string;
  /** Rendered image `sizes` — pass a real value once this is used at
   * more than one fixed width; both current call sites are a single
   * fixed-width decorative panel. */
  sizes?: string;
}

export function BrandMark({ className, sizes = "12rem" }: BrandMarkProps) {
  return (
    <div className={cx(styles.wrap, className)}>
      <div className={styles.imageBox}>
        <Image
          src="/images/brand/moral-tree-mark.png"
          alt="The Moral Tree — Moral Tree Media's symbol"
          fill
          sizes={sizes}
          className={styles.image}
        />
      </div>
      <span className={styles.wordmark}>Moral Tree Media</span>
    </div>
  );
}
