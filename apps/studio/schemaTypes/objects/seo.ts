import { defineField, defineType } from "sanity";

/**
 * Reused on every routable document (pages, Story Worlds, news, legal) so
 * editors can override auto-generated metadata per-document.
 */
export default defineType({
  name: "seo",
  title: "SEO",
  type: "object",
  fields: [
    defineField({
      name: "metaTitle",
      title: "Meta title",
      type: "string",
      description: "Falls back to the document title if left blank.",
      validation: (rule) =>
        rule
          .max(60)
          .warning("Longer titles may be truncated in search results."),
    }),
    defineField({
      name: "metaDescription",
      title: "Meta description",
      type: "text",
      rows: 3,
      validation: (rule) =>
        rule
          .max(160)
          .warning("Longer descriptions may be truncated in search results."),
    }),
    defineField({
      name: "ogImage",
      title: "Social share image",
      type: "image",
      description:
        "Falls back to the site default if left blank. Recommended 1200×630.",
    }),
    defineField({
      name: "noIndex",
      title: "Hide from search engines",
      type: "boolean",
      initialValue: false,
    }),
  ],
  options: { collapsible: true, collapsed: true },
});
