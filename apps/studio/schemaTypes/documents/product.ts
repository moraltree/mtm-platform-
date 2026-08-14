import { defineField, defineType } from "sanity";

/**
 * A shop product. Deliberately does NOT store a price — `stripePriceId`
 * points at the Stripe Price object that's the actual source of truth for
 * what a customer is charged, fetched live at render time (see
 * apps/web/src/lib/stripe.ts). Storing a second, editable price here would
 * let the displayed price drift from what checkout actually charges;
 * better to have exactly one place that can be wrong. Create the Price in
 * the Stripe Dashboard first, then paste its ID here.
 */
export default defineType({
  name: "product",
  title: "Product",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "blockContent",
    }),
    defineField({
      name: "images",
      title: "Images",
      type: "array",
      of: [
        {
          type: "image",
          options: { hotspot: true },
          fields: [
            {
              name: "alt",
              title: "Alternative text",
              type: "string",
              validation: (rule) => rule.required(),
            },
          ],
        },
      ],
      validation: (rule) => rule.min(1),
    }),
    defineField({
      name: "priceType",
      title: "Price type",
      type: "string",
      options: {
        list: [
          { title: "One-time purchase", value: "one-time" },
          { title: "Subscription", value: "subscription" },
        ],
        layout: "radio",
      },
      initialValue: "one-time",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "subscriptionInterval",
      title: "Billing interval",
      type: "string",
      options: {
        list: [
          { title: "Monthly", value: "month" },
          { title: "Yearly", value: "year" },
        ],
      },
      hidden: ({ parent }) => parent?.priceType !== "subscription",
      description:
        "Informational only — the Stripe Price itself defines the real interval.",
    }),
    defineField({
      name: "stripePriceId",
      title: "Stripe Price ID",
      type: "string",
      description:
        "From the Stripe Dashboard (Product catalog → the Price's ID, starts with \"price_\"). The product won't be purchasable — and its live price won't display — without this.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "active",
      title: "Active",
      description:
        "Unpublish/hide from the catalogue without deleting the product.",
      type: "boolean",
      initialValue: true,
    }),
    defineField({
      name: "featured",
      title: "Featured",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "order",
      title: "Display order",
      type: "number",
      initialValue: 0,
    }),
    defineField({ name: "seo", title: "SEO", type: "seo" }),
  ],
  orderings: [
    {
      title: "Display order",
      name: "orderAsc",
      by: [{ field: "order", direction: "asc" }],
    },
  ],
  preview: {
    select: { title: "title", subtitle: "priceType", media: "images.0" },
  },
});
