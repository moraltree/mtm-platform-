import Image from "next/image";
import type { PortableTextComponents } from "@portabletext/react";
import { PortableText } from "@portabletext/react";
import type { SanityImageSource } from "@sanity/image-url";
import styles from "./RichText.module.css";
import { cx } from "@/lib/cx";
import { urlFor } from "@/lib/sanity/image";

type ImageValue = SanityImageSource & { alt?: string; caption?: string };

interface InternalLinkValue {
  reference?: { _ref: string; _type: string };
}

interface ExternalLinkValue {
  url?: string;
  openInNewTab?: boolean;
}

export interface RichTextProps {
  value: unknown;
  /**
   * Resolves an internalLink annotation's reference to a real URL. Until
   * WP4/5 dereference `reference` in the GROQ projection and pass this in,
   * internal links render as styled (non-interactive) text rather than a
   * broken `<a>` with no href.
   */
  resolveInternalLink?: (ref: {
    _ref: string;
    _type: string;
  }) => string | undefined;
  width?: "narrow" | "wide";
}

export function RichText({
  value,
  resolveInternalLink,
  width = "narrow",
}: RichTextProps) {
  if (!value) return null;

  const components: PortableTextComponents = {
    block: {
      normal: ({ children }) => <p className={styles.paragraph}>{children}</p>,
      h2: ({ children }) => <h2 className={styles.h2}>{children}</h2>,
      h3: ({ children }) => <h3 className={styles.h3}>{children}</h3>,
      h4: ({ children }) => <h4 className={styles.h4}>{children}</h4>,
      blockquote: ({ children }) => (
        <blockquote className={styles.blockquote}>{children}</blockquote>
      ),
    },
    list: {
      bullet: ({ children }) => <ul className={styles.list}>{children}</ul>,
      number: ({ children }) => <ol className={styles.list}>{children}</ol>,
    },
    listItem: {
      bullet: ({ children }) => <li>{children}</li>,
      number: ({ children }) => <li>{children}</li>,
    },
    marks: {
      strong: ({ children }) => <strong>{children}</strong>,
      em: ({ children }) => <em>{children}</em>,
      internalLink: ({ children, value: mark }) => {
        const typed = mark as InternalLinkValue | undefined;
        const href = typed?.reference && resolveInternalLink?.(typed.reference);
        if (!href) {
          return <span className={styles.link}>{children}</span>;
        }
        return (
          <a href={href} className={styles.link}>
            {children}
          </a>
        );
      },
      externalLink: ({ children, value: mark }) => {
        const typed = mark as ExternalLinkValue | undefined;
        return (
          <a
            href={typed?.url}
            className={styles.link}
            target={typed?.openInNewTab ? "_blank" : undefined}
            rel={typed?.openInNewTab ? "noopener noreferrer" : undefined}
          >
            {children}
          </a>
        );
      },
    },
    types: {
      image: ({ value }) => {
        const image = value as ImageValue;
        const src = urlFor(image)?.width(1600).fit("max").url();
        if (!src) return null;
        return (
          <figure className={styles.figure}>
            <div className={styles.figureMedia}>
              <Image
                src={src}
                alt={image.alt || ""}
                fill
                sizes="(min-width: 64rem) 40rem, 100vw"
                className={styles.figureImage}
              />
            </div>
            {image.caption && (
              <figcaption className={styles.caption}>
                {image.caption}
              </figcaption>
            )}
          </figure>
        );
      },
    },
  };

  return (
    <div className={cx(styles.richText, width === "wide" && styles.wide)}>
      <PortableText value={value as never} components={components} />
    </div>
  );
}
