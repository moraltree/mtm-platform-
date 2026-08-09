import { defineField, defineType } from "sanity";

/**
 * A single call-to-action link: either an internal reference to a routable
 * document, or an external URL. Used by hero/CTA/card blocks and navigation.
 */
export default defineType({
  name: "link",
  title: "Link",
  type: "object",
  fields: [
    defineField({
      name: "label",
      title: "Label",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "type",
      title: "Link type",
      type: "string",
      options: {
        list: [
          { title: "Internal page", value: "internal" },
          { title: "External URL", value: "external" },
        ],
        layout: "radio",
      },
      initialValue: "internal",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "internalRef",
      title: "Page",
      type: "reference",
      to: [
        { type: "page" },
        { type: "storyWorld" },
        { type: "newsPost" },
        { type: "legalPage" },
      ],
      hidden: ({ parent }) => parent?.type !== "internal",
      validation: (rule) =>
        rule.custom((value, context) => {
          const parent = context.parent as { type?: string } | undefined;
          if (parent?.type === "internal" && !value)
            return "Required for internal links.";
          return true;
        }),
    }),
    defineField({
      name: "externalUrl",
      title: "URL",
      type: "url",
      hidden: ({ parent }) => parent?.type !== "external",
      validation: (rule) =>
        rule.custom((value, context) => {
          const parent = context.parent as { type?: string } | undefined;
          if (parent?.type === "external" && !value)
            return "Required for external links.";
          return true;
        }),
    }),
    defineField({
      name: "openInNewTab",
      title: "Open in new tab",
      type: "boolean",
      initialValue: false,
      hidden: ({ parent }) => parent?.type !== "external",
    }),
  ],
  preview: {
    select: { title: "label", subtitle: "externalUrl" },
  },
});
