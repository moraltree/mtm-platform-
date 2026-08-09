import { defineField, defineType } from "sanity";

/**
 * Generic routable page, reused for every corporate and capability page in
 * the Phase One spec (Home, About, Founder, Mission, Publishing,
 * Audiobooks, Animation, Contact). `pageId` is a fixed identifier used to
 * pin one singleton document per page in the Studio structure (WP2) and to
 * look pages up in code, independent of the editable `slug`.
 */
export default defineType({
  name: "page",
  title: "Page",
  type: "document",
  fields: [
    defineField({
      name: "pageId",
      title: "Page identifier",
      type: "string",
      options: {
        list: [
          { title: "Home", value: "home" },
          { title: "About", value: "about" },
          { title: "Founder", value: "founder" },
          { title: "Leadership", value: "leadership" },
          { title: "Mission", value: "mission" },
          { title: "Publishing", value: "publishing" },
          { title: "Audiobooks", value: "audiobooks" },
          { title: "Animation", value: "animation" },
          { title: "Contact", value: "contact" },
          { title: "Story Worlds index", value: "story-worlds" },
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "sections",
      title: "Sections",
      type: "pageBuilder",
    }),
    defineField({ name: "seo", title: "SEO", type: "seo" }),
  ],
  preview: {
    select: { title: "title", subtitle: "pageId" },
  },
});
