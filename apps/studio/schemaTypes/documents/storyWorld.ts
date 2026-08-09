import { defineField, defineType } from "sanity";

/**
 * Backs both the Story Worlds index (queried as a list) and the reusable
 * Story World detail template (WP6) — one document type, one route
 * template, per the spec.
 */
export default defineType({
  name: "storyWorld",
  title: "Story World",
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
      name: "tagline",
      title: "Tagline",
      type: "string",
      validation: (rule) => rule.max(140),
    }),
    defineField({
      name: "formats",
      title: "Formats",
      description: "Which capability areas this Story World spans.",
      type: "array",
      of: [{ type: "string" }],
      options: {
        list: [
          { title: "Publishing", value: "publishing" },
          { title: "Audiobooks", value: "audiobooks" },
          { title: "Animation", value: "animation" },
        ],
      },
    }),
    defineField({
      name: "status",
      title: "Status",
      type: "string",
      options: {
        list: [
          { title: "In development", value: "in-development" },
          { title: "Released", value: "released" },
          { title: "Announced", value: "announced" },
        ],
      },
      initialValue: "in-development",
    }),
    defineField({
      name: "heroImage",
      title: "Hero image",
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
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "synopsis",
      title: "Synopsis",
      type: "blockContent",
    }),
    defineField({
      name: "gallery",
      title: "Gallery",
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
    }),
    defineField({
      name: "sections",
      title: "Additional sections",
      type: "pageBuilder",
    }),
    defineField({
      name: "featured",
      title: "Featured",
      description:
        'Eligible for "Featured Story Worlds" grids elsewhere on the site.',
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
    select: { title: "title", subtitle: "status", media: "heroImage" },
  },
});
