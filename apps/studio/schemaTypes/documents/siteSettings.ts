import { defineArrayMember, defineField, defineType } from "sanity";

/**
 * Singleton — pinned as the only entry of this type in the Studio
 * structure (WP2). Global nav, footer, default SEO, org/contact details for
 * legal footer text, and the cookie-consent banner copy (WCAG/consent
 * requirements from the spec). Analytics vendor keys are env vars, not
 * CMS content — see apps/web/.env.example.
 */
export default defineType({
  name: "siteSettings",
  title: "Site settings",
  type: "document",
  fields: [
    defineField({
      name: "siteTitle",
      title: "Site title",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({ name: "tagline", title: "Tagline", type: "string" }),
    defineField({
      name: "logo",
      title: "Logo",
      type: "image",
      fields: [{ name: "alt", title: "Alternative text", type: "string" }],
    }),
    defineField({
      name: "primaryNav",
      title: "Primary navigation",
      type: "array",
      of: [defineArrayMember({ type: "link" })],
    }),
    defineField({
      name: "footerNav",
      title: "Footer navigation",
      type: "array",
      of: [defineArrayMember({ type: "link" })],
      description:
        "Legal pages with “Show in footer navigation” are appended automatically.",
    }),
    defineField({
      name: "socialLinks",
      title: "Social links",
      type: "array",
      of: [defineArrayMember({ type: "link" })],
    }),
    defineField({
      name: "footerNote",
      title: "Footer note / copyright",
      type: "string",
    }),
    defineField({
      name: "contactEmail",
      title: "Contact email",
      type: "string",
      validation: (rule) => rule.email(),
    }),
    defineField({
      name: "contactAddress",
      title: "Contact address",
      type: "text",
      rows: 2,
    }),
    defineField({
      name: "defaultSeo",
      title: "Default SEO",
      type: "seo",
      description:
        "Fallback used by pages that don't set their own SEO fields.",
    }),
    defineField({
      name: "consentBanner",
      title: "Cookie consent banner",
      type: "object",
      fields: [
        defineField({
          name: "enabled",
          title: "Enabled",
          type: "boolean",
          initialValue: true,
        }),
        defineField({
          name: "message",
          title: "Message",
          type: "text",
          rows: 3,
        }),
        defineField({ name: "policyLink", title: "Policy link", type: "link" }),
      ],
    }),
  ],
  preview: {
    prepare() {
      return { title: "Site settings" };
    },
  },
});
