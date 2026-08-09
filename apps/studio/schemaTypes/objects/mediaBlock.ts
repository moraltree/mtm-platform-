import { defineField, defineType } from "sanity";

export default defineType({
  name: "mediaBlock",
  title: "Media",
  type: "object",
  fields: [
    defineField({
      name: "mediaType",
      title: "Media type",
      type: "string",
      options: {
        list: [
          { title: "Image", value: "image" },
          { title: "Video (external embed)", value: "video" },
        ],
        layout: "radio",
      },
      initialValue: "image",
    }),
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
      hidden: ({ parent }) => parent?.mediaType !== "image",
    }),
    defineField({
      name: "videoUrl",
      title: "Video URL",
      type: "url",
      description:
        "YouTube/Vimeo URL. Embedded lazily to protect Core Web Vitals.",
      hidden: ({ parent }) => parent?.mediaType !== "video",
    }),
    defineField({
      name: "videoCaptionsNote",
      title: "Captions/transcript note",
      type: "string",
      description:
        "Internal note confirming captions exist (WCAG 2.2 AA requirement).",
      hidden: ({ parent }) => parent?.mediaType !== "video",
    }),
    defineField({ name: "caption", title: "Caption", type: "string" }),
    defineField({
      name: "fullBleed",
      title: "Full-bleed layout",
      type: "boolean",
      initialValue: false,
    }),
  ],
  preview: {
    select: { title: "caption", media: "image", mediaType: "mediaType" },
    prepare({ title, media, mediaType }) {
      return { title: title || "Media block", subtitle: mediaType, media };
    },
  },
});
