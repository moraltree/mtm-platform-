"use client";

import { useEffect } from "react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import styles from "./status-page.module.css";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // No error-reporting service wired up yet — this is the seam for one
    // (Sentry, etc.) once the owner picks a provider.
    console.error(error);
  }, [error]);

  return (
    <Container className={styles.wrap}>
      <p className={styles.code}>Error</p>
      <h1>Something went wrong</h1>
      <p className={styles.body}>
        An unexpected error occurred while loading this page. You can try again,
        or head back to the homepage.
      </p>
      <Button type="button" onClick={() => reset()}>
        Try again
      </Button>
    </Container>
  );
}
