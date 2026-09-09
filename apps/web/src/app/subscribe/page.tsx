import type { Metadata } from "next";
import { cookies } from "next/headers";
import { PropositionShell } from "@/components/patterns/PropositionShell";
import { ContactForm } from "@/components/patterns/ContactForm";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { buildMetadata } from "@/lib/metadata";
import { areSubscriptionPlansConfigured } from "@/lib/subscriptionPlans";
import {
  getSubscriptionByCorrelationRef,
  hasPaidAccess,
  type SubscriptionStatus,
} from "@/lib/subscriptionEntitlement";
import {
  SUBSCRIPTION_CORRELATION_COOKIE,
} from "@/lib/subscriptionCorrelation";
import { StarIcon } from "./subscribe-icons";
import { SubscribeForm } from "./SubscribeForm";
import styles from "./subscribe-page.module.css";

/**
 * Subscription page — shows real Stripe-hosted Checkout when plans are
 * configured (STRIPE_PRICE_MONTHLY / STRIPE_PRICE_ANNUAL set), otherwise
 * falls back to the "coming soon" proposition shell + waitlist form so the
 * page is always honest about what's actually available.
 *
 * Returning subscribers (with the correlationRef cookie set) see their
 * subscription status and a Manage Billing link instead of the checkout form.
 */

export const metadata: Metadata = buildMetadata("Subscribe", {
  metaDescription:
    "Subscribe to Moral Tree Media — unlimited access to the full audiobook library across every Story World.",
});

function statusLabel(status: SubscriptionStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "trialing":
      return "Free trial — will convert to paid subscription";
    case "past_due":
      return "Payment past due — please update your billing details";
    case "incomplete":
      return "Subscription pending — this can take a moment to confirm";
    case "cancelled":
      return "Cancelled";
    default:
      return "Unknown";
  }
}

export default async function SubscribePage() {
  const plansConfigured = areSubscriptionPlansConfigured();

  // Check if this visitor already has a subscription (via correlationRef cookie).
  const cookieStore = await cookies();
  const correlationRef = cookieStore.get(SUBSCRIPTION_CORRELATION_COOKIE)?.value;
  const existing = correlationRef
    ? await getSubscriptionByCorrelationRef(correlationRef)
    : null;

  const hasAccess = existing ? hasPaidAccess(existing.status) : false;

  // Subscriber already active — show status + manage billing.
  if (existing && existing.status !== "unknown") {
    return (
      <Container className={styles.wrap}>
        <div className={styles.statusCard}>
          <StarIcon />
          <h1 className={styles.heading}>Your Moral Tree Media subscription</h1>
          <dl className={styles.statusList}>
            <dt>Status</dt>
            <dd className={styles[`status-${existing.status}` as keyof typeof styles] ?? ""}>
              {statusLabel(existing.status)}
            </dd>
            {existing.plan && (
              <>
                <dt>Plan</dt>
                <dd>{existing.plan === "MONTHLY" ? "Monthly" : "Annual"}</dd>
              </>
            )}
            {existing.currentPeriodEnd && (
              <>
                <dt>
                  {existing.cancelAtPeriodEnd
                    ? "Access until"
                    : "Next renewal"}
                </dt>
                <dd>
                  {new Date(existing.currentPeriodEnd).toLocaleDateString(
                    "en-GB",
                    { day: "numeric", month: "long", year: "numeric" },
                  )}
                </dd>
              </>
            )}
          </dl>
          {hasAccess && (
            <p className={styles.accessNote}>
              You have full access to the Moral Tree Media audiobook library.
            </p>
          )}
          {existing.stripeCustomerId && (
            <form action="/api/subscription/portal" method="POST">
              <input type="hidden" name="_action" value="create-portal" />
              <Button type="submit">Manage billing</Button>
            </form>
          )}
          {!hasAccess && existing.status === "incomplete" && (
            <p className={styles.pendingNote}>
              Your subscription is being confirmed — if this takes more than
              a few minutes, please{" "}
              <a href="/contact">contact us</a> and we&rsquo;ll help.
            </p>
          )}
          {existing.status === "cancelled" && (
            <div className={styles.resubscribeBox}>
              <p>Want to resubscribe? Choose a plan below.</p>
              <SubscribeForm />
            </div>
          )}
        </div>
      </Container>
    );
  }

  // Plans are live — show the checkout form.
  if (plansConfigured) {
    return (
      <Container className={styles.wrap}>
        <div className={styles.checkoutShell}>
          <div className={styles.checkoutIntro}>
            <StarIcon />
            <h1 className={styles.heading}>Subscribe to Moral Tree Media</h1>
            <p className={styles.intro}>
              Unlimited access to the full audiobook library across every Story
              World, as the catalogue grows. Choose monthly or annual billing —
              cancel anytime.
            </p>
            <ul className={styles.featureList}>
              <li>Every Story World, one subscription</li>
              <li>New titles included as they&rsquo;re released</li>
              <li>Family-friendly — designed for a household</li>
              <li>Cancel anytime, no long-term commitment</li>
            </ul>
          </div>
          <div className={styles.checkoutFormWrap}>
            <h2 className={styles.formHeading}>Start your subscription</h2>
            <SubscribeForm />
            <p className={styles.trialNote}>
              Already on the free trial?{" "}
              <a href="/free30">Visit the free trial page</a> — your trial
              registration is separate from a paid subscription.
            </p>
          </div>
        </div>
      </Container>
    );
  }

  // Plans not configured — show coming-soon shell + waitlist.
  return (
    <>
      <PropositionShell
        icon={<StarIcon />}
        eyebrow="Subscribe"
        heading="Subscriptions are coming"
        intro="A Moral Tree Media subscription will unlock the full audiobook library across every Story World as it grows. Subscription billing isn't live yet — there's nothing to pay for on this page — but you can start today with a real 30-day free trial, or join the waitlist below to hear the moment subscriptions launch."
        features={[
          {
            title: "One subscription, every Story World",
            body: "Access grows with the catalogue — new Story Worlds and titles included as they're released.",
          },
          {
            title: "Family-friendly pricing",
            body: "Designed around a household, not a single listener — pricing details will be confirmed at launch.",
          },
          {
            title: "Cancel anytime",
            body: "No long-term commitment once billing exists — the same straightforward terms as the free trial.",
          },
        ]}
        comingSoonNote="No card details are collected on this page — subscription billing genuinely isn't connected yet. Starting the free trial below doesn't require payment either."
        ctas={[{ label: "Start your 30-day free trial", href: "/free30" }]}
        secondaryLinks={[{ label: "Back to Audiobooks", href: "/audiobooks" }]}
      />
      <ContactForm
        heading="Join the subscription waitlist"
        intro="Tell us you're interested and we'll email you the moment subscriptions launch — no commitment, no card details."
      />
    </>
  );
}
