import { Container } from "@/components/ui/Container";
import { Card, type CardProps } from "@/components/ui/Card";
import { cx } from "@/lib/cx";
import styles from "./CardGrid.module.css";

export interface CardGridProps {
  heading?: string;
  columns?: 2 | 3 | 4;
  cards: CardProps[];
}

export function CardGrid({ heading, columns = 3, cards }: CardGridProps) {
  return (
    <section className={styles.section}>
      <Container>
        {heading && <h2 className={styles.heading}>{heading}</h2>}
        <div className={cx(styles.grid, styles[`cols${columns}`])}>
          {cards.map((card) => (
            <Card key={card.title} {...card} />
          ))}
        </div>
      </Container>
    </section>
  );
}
