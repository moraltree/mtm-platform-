import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { cx } from "@/lib/cx";
import styles from "./CtaPanel.module.css";

export interface CtaPanelProps {
  heading: string;
  body?: string;
  cta: { label: string; href: string; external?: boolean };
  tone?: "primary" | "neutral";
}

export function CtaPanel({
  heading,
  body,
  cta,
  tone = "primary",
}: CtaPanelProps) {
  return (
    <section className={cx(styles.panel, tone === "neutral" && styles.neutral)}>
      <Container className={styles.inner}>
        <div className={styles.text}>
          <h2 className={styles.heading}>{heading}</h2>
          {body && <p className={styles.body}>{body}</p>}
        </div>
        <Button
          href={cta.href}
          external={cta.external}
          variant={tone === "primary" ? "secondary" : "primary"}
          size="lg"
          className={tone === "primary" ? styles.ctaOnBrand : undefined}
        >
          {cta.label}
        </Button>
      </Container>
    </section>
  );
}
