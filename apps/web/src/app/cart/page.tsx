import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { CartView } from "@/components/patterns/CartView";
import styles from "./page.module.css";

// A personal, transient, client-only view of localStorage state — not
// content worth indexing.
export const metadata: Metadata = {
  title: "Your cart",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return (
    <Container className={styles.wrap}>
      <h1>Your cart</h1>
      <CartView />
    </Container>
  );
}
