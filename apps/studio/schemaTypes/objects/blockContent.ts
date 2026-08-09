import { defineArrayMember, defineType } from "sanity";

/**
 * Shared rich-text (Portable Text) type used inside the richText block,
 * Story World synopses, person bios, legal page bodies, and news posts.
 * Deliberately restricted — headings/marks/lists map 1:1 to the design
 * system's typography scale, so editors can't introduce styles it doesn't
 * define.
 */
export default defineType({
  name: "blockContent",
  title: "Rich text",
  type: "array",
  of: [
    defineArrayMember({
      type: "block",
      styles: [
        { title: "Body", value: "normal" },
        { title: "Heading 2", value: "h2" },
        { title: "Heading 3", value: "h3" },
        { title: "Heading 4", value: "h4" },
        { title: "Quote", value: "blockquote" },
      ],
      lists: [
        { title: "Bulleted list", value: "bullet" },
        { title: "Numbered list", value: "number" },
      ],
      marks: {
        decorators: [
          { title: "Bold", value: "strong" },
          { title: "Italic", value: "em" },
        ],
        annotations: [
          {
            name: "internalLink",
            title: "Internal link",
            type: "object",
            icon: () => "🔗",
            fields: [
              {
                name: "reference",
                title: "Page",
                type: "reference",
                to: [
                  { type: "page" },
                  { type: "storyWorld" },
                  { type: "newsPost" },
                  { type: "legalPage" },
                ],
              },
            ],
          },
          {
            name: "externalLink",
            title: "External link",
            type: "object",
            icon: () => "↗",
            fields: [
              { name: "url", title: "URL", type: "url" },
              {
                name: "openInNewTab",
                title: "Open in new tab",
                type: "boolean",
                initialValue: true,
              },
            ],
          },
        ],
      },
    }),
    defineArrayMember({
      type: "image",
      options: { hotspot: true },
      fields: [
        {
          name: "alt",
          title: "Alternative text",
          type: "string",
          description: "Required for accessibility (WCAG 2.2 AA).",
          validation: (rule) => rule.required(),
        },
        { name: "caption", title: "Caption", type: "string" },
      ],
    }),
  ],
});
