import { defineField, defineType } from "sanity";

/**
 * Internal subscription state — written exclusively by the Stripe webhook
 * handler (apps/web/src/app/api/stripe/webhook/route.ts) via the
 * write-authenticated Sanity client. Never hand-authored in the Studio.
 * Stripe remains the authoritative record for all billing/payment data;
 * this exists so subscription status is queryable server-side for
 * entitlement checks without a round-trip to the Stripe API on every
 * request.
 *
 * No card number, CVC, or raw payment credential is stored here — Stripe
 * owns all of that. This document holds only the opaque Stripe IDs needed
 * to look things up, the internal plan/status, and the attribution
 * metadata preserved through the checkout.
 */
export default defineType({
  name: "subscription",
  title: "Subscription",
  type: "document",
  fields: [
    defineField({
      name: "correlationRef",
      title: "Correlation reference",
      type: "string",
      description:
        "Internal UUID generated at checkout start (client_reference_id in Stripe). " +
        "The primary lookup key for entitlement checks — never a Stripe ID.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "stripeCheckoutSessionId",
      title: "Stripe Checkout Session ID",
      type: "string",
      description:
        "Absent for platform-managed free trials, which never go through Stripe Checkout.",
    }),
    defineField({
      name: "stripeCustomerId",
      title: "Stripe Customer ID",
      type: "string",
    }),
    defineField({
      name: "stripeSubscriptionId",
      title: "Stripe Subscription ID",
      type: "string",
    }),
    defineField({
      name: "plan",
      title: "Plan",
      type: "string",
      options: {
        list: [
          { title: "Monthly", value: "MONTHLY" },
          { title: "Annual", value: "ANNUAL" },
        ],
      },
    }),
    defineField({
      name: "stripePriceId",
      title: "Stripe Price ID",
      type: "string",
      description: "The Stripe Price ID used at checkout — stored for audit, never re-used as a checkout input.",
    }),
    defineField({
      name: "status",
      title: "Status",
      type: "string",
      options: {
        list: [
          { title: "Incomplete (checkout not finished)", value: "incomplete" },
          { title: "Trialing", value: "trialing" },
          { title: "Active", value: "active" },
          { title: "Past due", value: "past_due" },
          { title: "Unpaid", value: "unpaid" },
          { title: "Cancelled", value: "cancelled" },
          { title: "Paused", value: "paused" },
        ],
      },
      initialValue: "incomplete",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "currentPeriodStart",
      title: "Current period start",
      type: "datetime",
    }),
    defineField({
      name: "currentPeriodEnd",
      title: "Current period end",
      type: "datetime",
    }),
    defineField({
      name: "cancelAtPeriodEnd",
      title: "Cancel at period end",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "cancelledAt",
      title: "Cancelled at",
      type: "datetime",
    }),
    // ── Trial fields ────────────────────────────────────────────────────
    // Written by the webhook from checkout session metadata. `trialDays`
    // is the server-approved duration at checkout time (0 = no trial).
    // `trialEligible` records whether the account was newly eligible —
    // useful for auditing if the eligibility logic changes.
    defineField({
      name: "trialDays",
      title: "Approved trial days",
      type: "number",
      description:
        "The trial duration approved at checkout time (0 = no trial). " +
        "Set by the server — never supplied by the browser.",
      initialValue: 0,
    }),
    defineField({
      name: "trialEligible",
      title: "Was trial-eligible at checkout",
      type: "boolean",
      description:
        "True when the email passed the repeat-trial eligibility check at checkout.",
      initialValue: false,
    }),
    defineField({
      name: "trialStartedAt",
      title: "Trial started at",
      type: "datetime",
      description: "Set when the trial subscription is first confirmed by webhook.",
    }),
    defineField({
      name: "trialEnd",
      title: "Trial end / expiry",
      type: "datetime",
      description:
        "For platform trials: the hard expiry date (trialStartedAt + 30 days), set at registration. " +
        "For Stripe subscription trials (legacy): the Stripe-reported trial end date.",
    }),
    defineField({
      name: "customerEmail",
      title: "Customer email",
      type: "string",
    }),
    // Attribution — preserved from checkout through to conversion.
    // Opaque IDs only; no PII beyond what Stripe already holds.
    defineField({
      name: "campaignId",
      title: "Campaign ID",
      type: "string",
    }),
    defineField({
      name: "acquisitionSource",
      title: "Acquisition source",
      type: "string",
    }),
    defineField({
      name: "partnerId",
      title: "Partner ID",
      type: "string",
    }),
    defineField({
      name: "storyWorldId",
      title: "Story World ID",
      type: "string",
    }),
    // Idempotency — the Stripe event ID of the last event that wrote to
    // this document. Checked before processing subscription lifecycle events
    // so duplicate webhook deliveries don't create duplicate conversions.
    defineField({
      name: "lastStripeEventId",
      title: "Last Stripe event ID processed",
      type: "string",
    }),
    defineField({
      name: "createdAt",
      title: "Created at",
      type: "datetime",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "updatedAt",
      title: "Last updated at",
      type: "datetime",
    }),
  ],
  orderings: [
    {
      title: "Created, new to old",
      name: "createdAtDesc",
      by: [{ field: "createdAt", direction: "desc" }],
    },
  ],
  preview: {
    select: {
      title: "customerEmail",
      subtitle: "status",
      plan: "plan",
    },
    prepare({ title, subtitle, plan }) {
      return {
        title: title || "(no email)",
        subtitle: `${subtitle}${plan ? ` — ${plan}` : ""}`,
      };
    },
  },
});
