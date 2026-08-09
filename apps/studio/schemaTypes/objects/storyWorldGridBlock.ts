import { defineArrayMember, defineField, defineType } from "sanity";

/**
 * Embeds a Story World teaser grid on other pages (e.g. Home). The Story
 * Worlds index route itself (WP6) queries all Story Worlds directly rather
 * than through this block.
 */
export default defineType({
  name: "storyWorldGridBlock",
  title: "Story World grid",
  type: "object",
  fields: [
    defineField({ name: "heading", title: "Heading", type: "string" }),
    defineField({
      name: "mode",
      title: "Selection",
      type: "string",
      options: {
        list: [
          { title: "Featured Story Worlds", value: "featured" },
          { title: "Curated list", value: "curated" },
        ],
      },
      initialValue: "featured",
    }),
    defineField({
      name: "storyWorlds",
      title: "Story Worlds",
      type: "array",
      of: [
        defineArrayMember({ type: "reference", to: [{ type: "storyWorld" }] }),
      ],
      hidden: ({ parent }) => parent?.mode !== "curated",
    }),
    defineField({
      name: "viewAllLink",
      title: "“View all” link",
      type: "link",
    }),
  ],
  preview: {
    select: { title: "heading" },
    prepare({ title }) {
      return { title: title || "Story World grid" };
    },
  },
});
