import { cx } from "@/lib/cx";
import styles from "./ProgressBar.module.css";

/** Thin listened-so-far bar used on story cards and Continue Listening.
 * With a `label` it's a real `progressbar` (announced); without one it's
 * decorative — for use inside a button, whose own accessible name
 * carries the progress instead (roles inside a button are flattened). */
export function ProgressBar({
  fraction,
  label,
  className,
}: {
  fraction: number;
  label?: string;
  className?: string;
}) {
  const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  if (!label) {
    return (
      <span className={cx(styles.track, className)} aria-hidden="true">
        <span className={styles.fill} style={{ width: `${percent}%` }} />
      </span>
    );
  }
  return (
    <span
      className={cx(styles.track, className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <span className={styles.fill} style={{ width: `${percent}%` }} />
    </span>
  );
}
