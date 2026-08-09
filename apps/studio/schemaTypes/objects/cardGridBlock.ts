import { defineArrayMember, defineField, defineType } from "sanity";

export const cardItem = defineType({
  name: "cardItem",
  title: "Card",
  type: "object",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({ name: "body", title: "Body", type: "text", rows: 3 }),
    defineField({
      name: "image",
      title: "Image",
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
    defineField({ name: "link", title: "Link", type: "link" }),
  ],
  preview: {
    select: { title: "title", media: "image" },
  },
});

export default defineType({
  name: "cardGridBlock",
  title: "Card grid",
  type: "object",
  fields: [
    defineField({ name: "heading", title: "Heading", type: "string" }),
    defineField({
      name: "columns",
      title: "Columns (desktop)",
      type: "number",
      options: { list: [2, 3, 4] },
      initialValue: 3,
    }),
    defineField({
      name: "cards",
      title: "Cards",
      type: "array",
      of: [defineArrayMember({ type: "cardItem" })],
      validation: (rule) => rule.min(1).required(),
    }),
  ],
  preview: {
    select: { title: "heading" },
    prepare({ title }) {
      return { title: title || "Card grid" };
    },
  },
});
