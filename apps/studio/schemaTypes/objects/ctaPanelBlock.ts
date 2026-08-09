import { defineField, defineType } from "sanity";

export default defineType({
  name: "ctaPanelBlock",
  title: "CTA panel",
  type: "object",
  fields: [
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({ name: "body", title: "Body", type: "text", rows: 3 }),
    defineField({
      name: "cta",
      title: "Call to action",
      type: "link",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "tone",
      title: "Tone",
      type: "string",
      options: {
        list: [
          { title: "Primary", value: "primary" },
          { title: "Neutral", value: "neutral" },
        ],
      },
      initialValue: "primary",
    }),
  ],
  preview: {
    select: { title: "heading", subtitle: "cta.label" },
  },
});
