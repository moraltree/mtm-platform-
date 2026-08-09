import { defineField, defineType } from "sanity";

/**
 * Generic type for all legal pages (Privacy Policy, Terms of Use, Cookie
 * Policy, etc.) — an open list rather than fixed identifiers like `page`,
 * since the exact set of legal documents is a legal/compliance decision
 * outside this codebase's scope.
 */
export default defineType({
  name: "legalPage",
  title: "Legal page",
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
      name: "effectiveDate",
      title: "Effective date",
      type: "date",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "body",
      title: "Body",
      type: "blockContent",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "showInFooter",
      title: "Show in footer navigation",
      type: "boolean",
      initialValue: true,
    }),
  ],
  preview: {
    select: { title: "title", subtitle: "effectiveDate" },
  },
});
