import { defineField, defineType } from "sanity";

/**
 * Marks where a form renders in the page builder. The form itself (fields,
 * spam/rate protection) is implemented in code (WP4), not authored in the
 * CMS — this block only carries editorial framing copy plus which form to
 * mount.
 */
export default defineType({
  name: "formEmbedBlock",
  title: "Form",
  type: "object",
  fields: [
    defineField({
      name: "form",
      title: "Form",
      type: "string",
      options: {
        list: [{ title: "Contact", value: "contact" }],
      },
      initialValue: "contact",
      validation: (rule) => rule.required(),
    }),
    defineField({ name: "heading", title: "Heading", type: "string" }),
    defineField({ name: "intro", title: "Intro", type: "text", rows: 2 }),
  ],
  preview: {
    select: { title: "heading", form: "form" },
    prepare({ title, form }) {
      return { title: title || "Form", subtitle: form };
    },
  },
});
