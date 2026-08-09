import { Container } from "@/components/ui/Container";
import styles from "./Timeline.module.css";

export interface TimelineEntry {
  date: string;
  title: string;
  body?: string;
}

export interface TimelineProps {
  heading?: string;
  entries: TimelineEntry[];
}

export function Timeline({ heading, entries }: TimelineProps) {
  return (
    <section className={styles.section}>
      <Container>
        {heading && <h2 className={styles.heading}>{heading}</h2>}
        <ol className={styles.list}>
          {entries.map((entry) => (
            <li key={`${entry.date}-${entry.title}`} className={styles.item}>
              <p className={styles.date}>{entry.date}</p>
              <h3 className={styles.title}>{entry.title}</h3>
              {entry.body && <p className={styles.body}>{entry.body}</p>}
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
