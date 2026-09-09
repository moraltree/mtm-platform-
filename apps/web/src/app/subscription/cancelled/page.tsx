import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import styles from "./page.module.css";

// Transient personal view — not indexable.
export const metadata: Metadata = {
  title: "Subscription checkout cancelled",
  robots: { index: false, follow: false },
};

/**
 * Cancel redirect target from Stripe Checkout for subscriptions.
 *
 * The customer left Stripe without completing payment — they have NOT been
 * charged, and no subscription has been created. They can return to
 * `/subscribe` to try again, or choose the free trial instead.
 *
 * This page never creates a paid entitlement — the user is safely back
 * where they were.
 */
export default function SubscriptionCancelledPage() {
  return (
    <Container className={styles.wrap}>
      <h1>Checkout cancelled</h1>
      <p>
        You haven&rsquo;t been charged. No subscription was created — you can
        try again whenever you&rsquo;re ready.
      </p>
      <div className={styles.actions}>
        <Button href="/subscribe">Back to Subscribe</Button>
        <Button href="/free30" variant="secondary">
          Try the free 30-day trial instead
        </Button>
      </div>
    </Container>
  );
}
