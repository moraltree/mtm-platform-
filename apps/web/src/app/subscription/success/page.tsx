import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import {
  getSubscriptionBySessionId,
  getSubscriptionByCorrelationRef,
  hasPaidAccess,
  type SubscriptionRecord,
} from "@/lib/subscriptionEntitlement";
import {
  SUBSCRIPTION_CORRELATION_COOKIE,
} from "@/lib/subscriptionCorrelation";
import styles from "./page.module.css";

// Transient personal view — not indexable.
export const metadata: Metadata = {
  title: "Subscription confirmed",
  robots: { index: false, follow: false },
};

/**
 * Success redirect target from Stripe Checkout for subscriptions.
 *
 * Does NOT grant entitlement by itself — entitlement is established by the
 * webhook writing the subscription record. This page shows the current
 * state from two sources:
 *   1. The correlationRef cookie → Sanity subscription document (most
 *      reliable — confirms the webhook has fired and the record is written)
 *   2. The session_id URL param → direct Stripe API lookup (available
 *      immediately, even before the webhook has fired)
 *
 * The page renders the most informative state it can find, and explicitly
 * calls out "pending webhook" when Sanity doesn't yet have the record.
 */
export default async function SubscriptionSuccessPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const sessionIdParam = searchParams.session_id;
  const sessionId =
    typeof sessionIdParam === "string" ? sessionIdParam : undefined;

  // Try Sanity first (webhook-confirmed source of truth).
  const cookieStore = await cookies();
  const correlationRef = cookieStore.get(SUBSCRIPTION_CORRELATION_COOKIE)?.value;
  let record: SubscriptionRecord | null = null;

  if (correlationRef) {
    const sanityRecord = await getSubscriptionByCorrelationRef(correlationRef);
    if (sanityRecord.status !== "unknown") {
      record = sanityRecord;
    }
  }

  // Fallback: direct Stripe API lookup.
  let stripeRecord: SubscriptionRecord | null = null;
  if (sessionId && !record) {
    const fromStripe = await getSubscriptionBySessionId(sessionId);
    if (fromStripe.status !== "unknown") {
      stripeRecord = fromStripe;
    }
  }

  const displayRecord = record ?? stripeRecord;
  const webhookConfirmed = Boolean(record);
  const isActive = displayRecord ? hasPaidAccess(displayRecord.status) : false;
  const hasCustomer = Boolean(
    displayRecord?.stripeCustomerId,
  );

  return (
    <Container className={styles.wrap}>
      {isActive || displayRecord?.status === "trialing" ? (
        <>
          <div className={styles.successIcon} aria-hidden="true">✓</div>
          <h1 className={styles.heading}>
            {displayRecord?.status === "trialing"
              ? "Your free trial has started"
              : "Subscription confirmed"}
          </h1>
          {webhookConfirmed ? (
            <p className={styles.body}>
              Your subscription is active. You have full access to the Moral
              Tree Media audiobook library.
            </p>
          ) : (
            <p className={styles.body}>
              Payment received — your subscription is being activated. This
              usually takes a few seconds; if it doesn&rsquo;t show as active
              within a minute, please{" "}
              <Link href="/contact">contact us</Link> and we&rsquo;ll help
              directly.
            </p>
          )}
        </>
      ) : displayRecord?.status === "incomplete" ? (
        <>
          <h1 className={styles.heading}>Subscription pending</h1>
          <p className={styles.body}>
            Your checkout completed but the subscription is still being
            confirmed — this normally takes just a moment. Please wait a
            minute and{" "}
            <Link href="/subscribe">check your subscription status</Link>.
            If it doesn&rsquo;t resolve, please{" "}
            <Link href="/contact">contact us</Link>.
          </p>
        </>
      ) : displayRecord?.status === "past_due" ? (
        <>
          <h1 className={styles.heading}>Payment issue</h1>
          <p className={styles.body}>
            There was a problem with your payment. Please{" "}
            {hasCustomer ? (
              <>
                <Link href="/subscribe">manage your billing</Link> to update
                your payment details.
              </>
            ) : (
              <>
                <Link href="/contact">contact us</Link> and we&rsquo;ll help
                resolve it.
              </>
            )}
          </p>
        </>
      ) : (
        <>
          <h1 className={styles.heading}>Subscription confirmed</h1>
          <p className={styles.body}>
            Your payment was received. If you don&rsquo;t see your subscription
            active within a few minutes, please{" "}
            <Link href="/contact">contact us</Link> and we&rsquo;ll help
            directly.
          </p>
        </>
      )}

      {displayRecord?.currentPeriodEnd && isActive && (
        <p className={styles.renewalNote}>
          {displayRecord.cancelAtPeriodEnd
            ? `Access until ${new Date(displayRecord.currentPeriodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`
            : `Next renewal: ${new Date(displayRecord.currentPeriodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`}
        </p>
      )}

      <div className={styles.actions}>
        <Button href="/subscribe">
          {hasCustomer ? "View subscription" : "Back to subscribe"}
        </Button>
        <Button href="/audiobooks" variant="secondary">
          Explore audiobooks
        </Button>
      </div>
    </Container>
  );
}
