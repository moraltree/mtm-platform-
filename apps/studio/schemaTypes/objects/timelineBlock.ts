import { defineArrayMember, defineField, defineType } from "sanity";

export const timelineEntry = defineType({
  name: "timelineEntry",
  title: "Timeline entry",
  type: "object",
  fields: [
    defineField({
      name: "date",
      title: "Date label",
      type: "string",
      description: 'Free text, e.g. "2024" or "Q3 2025".',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({ name: "body", title: "Body", type: "text", rows: 2 }),
  ],
  preview: {
    select: { title: "title", subtitle: "date" },
  },
});

export default defineType({
  name: "timelineBlock",
  title: "Timeline",
  type: "object",
  fields: [
    defineField({ name: "heading", title: "Heading", type: "string" }),
    defineField({
      name: "entries",
      title: "Entries",
      type: "array",
      of: [defineArrayMember({ type: "timelineEntry" })],
      validation: (rule) => rule.min(1).required(),
    }),
  ],
  preview: {
    select: { title: "heading" },
    prepare({ title }) {
      return { title: title || "Timeline" };
    },
  },
});
