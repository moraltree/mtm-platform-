import { defineArrayMember, defineField, defineType } from "sanity";

export const statItem = defineType({
  name: "statItem",
  title: "Statistic",
  type: "object",
  fields: [
    defineField({
      name: "value",
      title: "Value",
      type: "string",
      description: 'e.g. "12", "40%", "1.2M"',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "label",
      title: "Label",
      type: "string",
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: { title: "value", subtitle: "label" },
  },
});

export default defineType({
  name: "statsBlock",
  title: "Statistics",
  type: "object",
  fields: [
    defineField({ name: "heading", title: "Heading", type: "string" }),
    defineField({
      name: "stats",
      title: "Statistics",
      type: "array",
      of: [defineArrayMember({ type: "statItem" })],
      validation: (rule) => rule.min(1).max(6).required(),
    }),
  ],
  preview: {
    select: { title: "heading" },
    prepare({ title }) {
      return { title: title || "Statistics" };
    },
  },
});
