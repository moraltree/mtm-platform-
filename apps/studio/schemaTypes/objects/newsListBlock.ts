import { defineField, defineType } from "sanity";

export default defineType({
  name: "newsListBlock",
  title: "News list",
  type: "object",
  fields: [
    defineField({ name: "heading", title: "Heading", type: "string" }),
    defineField({
      name: "count",
      title: "Number of posts to show",
      type: "number",
      initialValue: 3,
      validation: (rule) => rule.min(1).max(12),
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
      return { title: title || "News list" };
    },
  },
});
