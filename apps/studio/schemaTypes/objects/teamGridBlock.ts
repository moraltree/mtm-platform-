import { defineArrayMember, defineField, defineType } from "sanity";

/**
 * Used on the Leadership page. Editors either curate an explicit list of
 * people, or leave it empty to auto-include everyone marked
 * `showOnLeadershipPage`, ordered by `order` — see the Leadership page
 * template in WP5/WP6.
 */
export default defineType({
  name: "teamGridBlock",
  title: "Team grid",
  type: "object",
  fields: [
    defineField({ name: "heading", title: "Heading", type: "string" }),
    defineField({
      name: "people",
      title: "People (leave empty to auto-populate)",
      type: "array",
      of: [defineArrayMember({ type: "reference", to: [{ type: "person" }] })],
    }),
  ],
  preview: {
    select: { title: "heading" },
    prepare({ title }) {
      return { title: title || "Team grid" };
    },
  },
});
