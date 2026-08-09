import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import styles from "./Hero.module.css";

export interface HeroCta {
  label: string;
  href: string;
  external?: boolean;
}

export interface HeroProps {
  eyebrow?: string;
  heading: string;
  subheading?: string;
  media?: { src: string; alt: string };
  ctas?: HeroCta[];
}

export function Hero({ eyebrow, heading, subheading, media, ctas }: HeroProps) {
  return (
    <section className={styles.hero}>
      <Container className={styles.inner}>
        <div className={styles.content}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          <h1 className={styles.heading}>{heading}</h1>
          {subheading && <p className={styles.subheading}>{subheading}</p>}
          {ctas && ctas.length > 0 && (
            <div className={styles.ctas}>
              {ctas.slice(0, 2).map((cta) => (
                <Button
                  key={cta.href}
                  href={cta.href}
                  external={cta.external}
                  variant={cta === ctas[0] ? "primary" : "secondary"}
                  size="lg"
                >
                  {cta.label}
                </Button>
              ))}
            </div>
          )}
        </div>
        {media && (
          <div className={styles.media}>
            <Image
              src={media.src}
              alt={media.alt}
              fill
              sizes="(min-width: 64rem) 40vw, 100vw"
              className={styles.image}
              priority
            />
          </div>
        )}
      </Container>
    </section>
  );
}
