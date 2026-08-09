import { defineField, defineType } from "sanity";

/**
 * Team members. Also used for the Founder — flag `isFounder` to surface a
 * person's profile on the dedicated Founder page (WP5) in addition to (or
 * instead of) the Leadership grid.
 */
export default defineType({
  name: "person",
  title: "Person",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "role",
      title: "Role / title",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "photo",
      title: "Photo",
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
    }),
    defineField({ name: "bio", title: "Bio", type: "blockContent" }),
    defineField({
      name: "isFounder",
      title: "Is founder",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "showOnLeadershipPage",
      title: "Show on Leadership page",
      type: "boolean",
      initialValue: true,
    }),
    defineField({
      name: "order",
      title: "Display order",
      type: "number",
      initialValue: 0,
    }),
    defineField({
      name: "socialLinks",
      title: "Social / external links",
      type: "array",
      of: [{ type: "link" }],
    }),
  ],
  orderings: [
    {
      title: "Display order",
      name: "orderAsc",
      by: [{ field: "order", direction: "asc" }],
    },
  ],
  preview: {
    select: { title: "name", subtitle: "role", media: "photo" },
  },
});
