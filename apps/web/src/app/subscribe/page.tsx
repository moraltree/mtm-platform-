import type { Metadata } from "next";
import { PropositionShell } from "@/components/patterns/PropositionShell";
import { ContactForm } from "@/components/patterns/ContactForm";
import { buildMetadata } from "@/lib/metadata";
import { StarIcon } from "./subscribe-icons";

/**
 * A dedicated subscription-intent page — not a real payment/subscription
 * flow (no Stripe/payment infrastructure exists for this yet, and
 * building one prematurely is exactly what this sprint's brief says not
 * to do), but a real, distinct destination rather than routing
 * "Subscribe" straight into the generic Contact form (the gap this page
 * closes — see audiobooks/page.tsx, the one current consumer). The one
 * real, working action here is the 30-day free trial (`/free30`,
 * genuinely functional); the waitlist below reuses `ContactForm`
 * verbatim (same validation/honeypot/rate-limiting/honest-degradation
 * contract, just its own heading/intro) rather than building a second,
 * parallel capture mechanism for what is, mechanically, the same
 * "notify a human" action ContactForm already does.
 *
 * Not Sanity-backed (like `/free30`, `/subscribe` isn't a `pageId`) —
 * there's no editorial content here to author, just a fixed intent page.
 */

export const metadata: Metadata = buildMetadata("Subscribe", {
  metaDescription:
    "Subscriptions to Moral Tree Media's full audiobook library are coming — start a free trial today or join the waitlist.",
});

export default function SubscribePage() {
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
