import { Container } from "@/components/ui/Container";
import styles from "./Quote.module.css";

export interface QuoteProps {
  quote: string;
  attribution?: string;
  role?: string;
}

export function Quote({ quote, attribution, role }: QuoteProps) {
  return (
    <section className={styles.section}>
      <Container>
        <figure className={styles.figure}>
          <blockquote className={styles.blockquote}>
            <p>{quote}</p>
          </blockquote>
          {(attribution || role) && (
            <figcaption className={styles.caption}>
              {attribution && (
                <span className={styles.name}>{attribution}</span>
              )}
              {role && <span className={styles.role}>{role}</span>}
            </figcaption>
          )}
        </figure>
      </Container>
    </section>
  );
}
