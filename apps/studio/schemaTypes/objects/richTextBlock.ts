import { defineField, defineType } from "sanity";

export default defineType({
  name: "richTextBlock",
  title: "Rich text",
  type: "object",
  fields: [
    defineField({
      name: "content",
      title: "Content",
      type: "blockContent",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "width",
      title: "Width",
      type: "string",
      options: {
        list: [
          { title: "Narrow (reading measure)", value: "narrow" },
          { title: "Wide", value: "wide" },
        ],
      },
      initialValue: "narrow",
    }),
  ],
  preview: {
    prepare() {
      return { title: "Rich text" };
    },
  },
});
