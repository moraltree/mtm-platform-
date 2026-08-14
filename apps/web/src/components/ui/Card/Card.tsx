import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./Card.module.css";
import { cx } from "@/lib/cx";

export interface CardProps {
  title: string;
  /** Rendered directly under the title — e.g. a price line (shop) or a
   * status badge row (Story Worlds), before the descriptive `body`. */
  meta?: ReactNode;
  body?: ReactNode;
  image?: { src: string; alt: string };
  href?: string;
  className?: string;
}

/**
 * A single content card. If `href` is present the whole card is the
 * click/tap target (one link, not nested interactive elements) — image alt
 * text stays empty in that case since the link's accessible name already
 * comes from the heading.
 */
export function Card({ title, meta, body, image, href, className }: CardProps) {
  const content = (
    <>
      {image && (
        <div className={styles.media}>
          <Image
            src={image.src}
            alt={href ? "" : image.alt}
            fill
            sizes="(min-width: 64rem) 33vw, (min-width: 48rem) 50vw, 100vw"
            className={styles.image}
          />
        </div>
      )}
      <div className={styles.body}>
        <h3 className={styles.title}>{title}</h3>
        {meta && <div className={styles.meta}>{meta}</div>}
        {body && <p className={styles.text}>{body}</p>}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cx(styles.card, styles.cardLink, className)}>
        {content}
      </Link>
    );
  }

  return <article className={cx(styles.card, className)}>{content}</article>;
}
