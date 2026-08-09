import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { cx } from "@/lib/cx";
import styles from "./Media.module.css";

export type MediaProps =
  | {
      type: "image";
      image: { src: string; alt: string };
      caption?: string;
      fullBleed?: boolean;
    }
  | {
      type: "video";
      videoUrl: string;
      caption?: string;
      fullBleed?: boolean;
    };

export function Media(props: MediaProps) {
  const body = (
    <figure className={styles.figure}>
      <div className={cx(styles.media, props.fullBleed && styles.fullBleed)}>
        {props.type === "image" ? (
          <Image
            src={props.image.src}
            alt={props.image.alt}
            fill
            sizes="100vw"
            className={styles.image}
          />
        ) : (
          // Native lazy-loading defers the embed's JS/network cost until
          // it's near the viewport — no custom facade needed without a
          // thumbnail field on the schema (see storyworld/mediaBlock).
          <iframe
            src={props.videoUrl}
            title={props.caption || "Embedded video"}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className={styles.iframe}
          />
        )}
      </div>
      {props.caption && (
        <figcaption className={styles.caption}>{props.caption}</figcaption>
      )}
    </figure>
  );

  if (props.fullBleed) {
    return <section className={styles.section}>{body}</section>;
  }

  return (
    <section className={styles.section}>
      <Container>{body}</Container>
    </section>
  );
}
