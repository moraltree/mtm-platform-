import { defineField, defineType } from "sanity";

export default defineType({
  name: "quoteBlock",
  title: "Quote",
  type: "object",
  fields: [
    defineField({
      name: "quote",
      title: "Quote",
      type: "text",
      rows: 3,
      validation: (rule) => rule.required(),
    }),
    defineField({ name: "attribution", title: "Attribution", type: "string" }),
    defineField({ name: "role", title: "Role / affiliation", type: "string" }),
  ],
  preview: {
    select: { title: "quote", subtitle: "attribution" },
  },
});
