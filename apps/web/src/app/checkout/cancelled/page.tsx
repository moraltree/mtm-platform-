import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Checkout cancelled",
  robots: { index: false, follow: false },
};

export default function CheckoutCancelledPage() {
  return (
    <Container className={styles.wrap}>
      <h1>Checkout cancelled</h1>
      <p>
        You haven&rsquo;t been charged. Your cart is still saved if you&rsquo;d
        like to try again.
      </p>
      <div className={styles.actions}>
        <Button href="/cart">Back to cart</Button>
        <Button href="/shop" variant="secondary">
          Continue shopping
        </Button>
      </div>
    </Container>
  );
}
