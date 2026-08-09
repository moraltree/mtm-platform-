import { Container } from "@/components/ui/Container";
import styles from "./Stats.module.css";

export interface StatItem {
  value: string;
  label: string;
}

export interface StatsProps {
  heading?: string;
  stats: StatItem[];
}

export function Stats({ heading, stats }: StatsProps) {
  return (
    <section className={styles.section}>
      <Container>
        {heading && <h2 className={styles.heading}>{heading}</h2>}
        <dl className={styles.grid}>
          {stats.map((stat) => (
            <div key={stat.label} className={styles.item}>
              <dt className={styles.label}>{stat.label}</dt>
              <dd className={styles.value}>{stat.value}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}
