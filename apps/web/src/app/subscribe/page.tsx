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
import {
  FIRST_TOUCH_COOKIE_NAME,
  LATEST_TOUCH_COOKIE_NAME,
  parseAttributionCookie,
} from "@/lib/attribution/cookie";
import { resolveTrialDaysFromConfig } from "@/lib/trialConfig";
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

  // Resolve the advertised trial duration from campaign attribution cookies.
  // This is a display-only preview — the actual trial applied at checkout may
  // differ if the visitor is ineligible. We intentionally don't run the
  // eligibility check on page load (it requires the email address, which is
  // captured in the form, and we avoid blocking the page render on a Sanity
  // query unless we have to).
  const latestAttribution = parseAttributionCookie(
    cookieStore.get(LATEST_TOUCH_COOKIE_NAME)?.value,
  );
  // First-touch attribution read but only used for display in the coming-soon section.
  cookieStore.get(FIRST_TOUCH_COOKIE_NAME);
  const advertisedTrialDays = resolveTrialDaysFromConfig(
    latestAttribution?.campaignId,
    latestAttribution?.acquisitionSource,
  );

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
    const trialHeading =
      advertisedTrialDays > 0
        ? `Start your ${advertisedTrialDays}-day free trial`
        : "Start your subscription";

    return (
      <Container className={styles.wrap}>
        <div className={styles.checkoutShell}>
          <div className={styles.checkoutIntro}>
            <StarIcon />
            <h1 className={styles.heading}>Subscribe to Moral Tree Media</h1>
            <p className={styles.intro}>
              {advertisedTrialDays > 0
                ? `Try Moral Tree Media free for ${advertisedTrialDays} days, then choose monthly or annual billing. Cancel anytime.`
                : "Unlimited access to the full audiobook library across every Story World, as the catalogue grows. Choose monthly or annual billing — cancel anytime."}
            </p>
            <ul className={styles.featureList}>
              {advertisedTrialDays > 0 && (
                <li>
                  {advertisedTrialDays} days free — then pay only if you love it
                </li>
              )}
              <li>Every Story World, one subscription</li>
              <li>New titles included as they&rsquo;re released</li>
              <li>Family-friendly — designed for a household</li>
              <li>Cancel anytime, no long-term commitment</li>
            </ul>
          </div>
          <div className={styles.checkoutFormWrap}>
            <h2 className={styles.formHeading}>{trialHeading}</h2>
            <SubscribeForm trialDays={advertisedTrialDays} />
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
