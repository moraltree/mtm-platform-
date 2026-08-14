import { defineField, defineType } from "sanity";

/**
 * Written exclusively by the Stripe webhook handler
 * (apps/web/src/app/api/stripe/webhook/route.ts) via a separate,
 * write-authenticated Sanity client — nothing in the Studio UI creates
 * these, and no one should hand-author one. Stripe itself remains the
 * authoritative record (Dashboard, or the API) for anything this
 * document doesn't capture; this exists so orders show up alongside the
 * rest of the site's content for a quick read-only look, not to replace
 * Stripe's own records.
 */
export default defineType({
  name: "order",
  title: "Order",
  type: "document",
  fields: [
    defineField({
      name: "stripeCheckoutSessionId",
      title: "Stripe Checkout Session ID",
      type: "string",
      validation: (rule) => rule.required(),
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
      description: 'Only set when mode is "subscription".',
    }),
    defineField({
      name: "mode",
      title: "Mode",
      type: "string",
      options: {
        list: [
          { title: "Payment", value: "payment" },
          { title: "Subscription", value: "subscription" },
        ],
      },
    }),
    defineField({
      name: "customerEmail",
      title: "Customer email",
      type: "string",
    }),
    defineField({
      name: "items",
      title: "Line items",
      type: "array",
      of: [
        {
          type: "object",
          name: "orderLineItem",
          fields: [
            {
              name: "productRef",
              title: "Product",
              type: "reference",
              to: [{ type: "product" }],
            },
            {
              name: "title",
              title: "Title (at time of order)",
              type: "string",
            },
            { name: "quantity", title: "Quantity", type: "number" },
            { name: "stripePriceId", title: "Stripe Price ID", type: "string" },
          ],
        },
      ],
    }),
    defineField({
      name: "amountTotal",
      title: "Amount total (minor units, e.g. pence)",
      type: "number",
    }),
    defineField({ name: "currency", title: "Currency", type: "string" }),
    defineField({
      name: "status",
      title: "Status",
      type: "string",
      options: {
        list: [
          { title: "Paid", value: "paid" },
          { title: "Refunded", value: "refunded" },
          { title: "Subscription cancelled", value: "cancelled" },
        ],
      },
      initialValue: "paid",
    }),
    defineField({
      name: "placedAt",
      title: "Placed at",
      type: "datetime",
      validation: (rule) => rule.required(),
    }),
  ],
  orderings: [
    {
      title: "Placed at, new to old",
      name: "placedAtDesc",
      by: [{ field: "placedAt", direction: "desc" }],
    },
  ],
  preview: {
    select: {
      title: "customerEmail",
      subtitle: "status",
      amount: "amountTotal",
    },
    prepare({ title, subtitle, amount }) {
      return {
        title: title || "(no email)",
        subtitle: `${subtitle}${amount ? ` — ${amount}` : ""}`,
      };
    },
  },
});
