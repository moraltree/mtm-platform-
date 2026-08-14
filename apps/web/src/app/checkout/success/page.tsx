import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { ClearCartOnMount } from "@/components/patterns/ClearCartOnMount";
import { isStripeConfigured, stripe } from "@/lib/stripe";
import { formatPrice } from "@/lib/format";
import styles from "./page.module.css";

// A personal, one-time confirmation view keyed off Stripe's own
// session_id query param — not content worth indexing.
export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false, follow: false },
};

interface CheckoutSummary {
  amountTotal: number | null;
  currency: string | null;
  email: string | null;
  isSubscription: boolean;
}

export default async function CheckoutSuccessPage(
  props: PageProps<"/checkout/success">,
) {
  const searchParams = await props.searchParams;
  const sessionIdParam = searchParams.session_id;
  const sessionId =
    typeof sessionIdParam === "string" ? sessionIdParam : undefined;

  let summary: CheckoutSummary | null = null;

  // Best-effort: this page still confirms the order even if the live
  // Session lookup fails or Stripe isn't configured — Stripe itself is
  // the source of truth for whether payment succeeded (this page doesn't
  // gate anything), so a lookup failure degrades the message, not the
  // outcome.
  if (sessionId && isStripeConfigured && stripe) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      summary = {
        amountTotal: session.amount_total,
        currency: session.currency,
        email: session.customer_details?.email ?? null,
        isSubscription: session.mode === "subscription",
      };
    } catch (error) {
      console.error(
        "Failed to retrieve Checkout Session for the success page:",
        error,
      );
    }
  }

  return (
    <Container className={styles.wrap}>
      <h1>Thank you — your order is confirmed</h1>

      {summary?.amountTotal != null && summary.currency ? (
        <div className={styles.summary}>
          <p>
            You paid {formatPrice(summary.amountTotal, summary.currency)}
            {summary.isSubscription ? ", recurring" : ""}.
          </p>
          {summary.email && (
            <p>A confirmation email has been sent to {summary.email}.</p>
          )}
        </div>
      ) : (
        <p>
          Your payment was received. If a confirmation email doesn&rsquo;t
          arrive shortly, please contact us and we&rsquo;ll help directly.
        </p>
      )}

      <Button href="/shop">Continue shopping</Button>
      <ClearCartOnMount />
    </Container>
  );
}
