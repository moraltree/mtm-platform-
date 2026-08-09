import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import styles from "./status-page.module.css";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <Container className={styles.wrap}>
      <p className={styles.code}>404</p>
      <h1>Page not found</h1>
      <p className={styles.body}>
        The page you&rsquo;re looking for doesn&rsquo;t exist or may have moved.
      </p>
      <Button href="/">Back to home</Button>
    </Container>
  );
}
