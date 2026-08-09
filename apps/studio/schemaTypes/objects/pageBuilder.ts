import { defineArrayMember, defineType } from "sanity";

/**
 * The flexible section list used by every routable page. Each member maps
 * 1:1 to a design-system pattern (WP3) so content and presentation stay
 * coupled by convention rather than by ad hoc fields.
 */
export default defineType({
  name: "pageBuilder",
  title: "Page sections",
  type: "array",
  of: [
    defineArrayMember({ type: "heroBlock" }),
    defineArrayMember({ type: "richTextBlock" }),
    defineArrayMember({ type: "ctaPanelBlock" }),
    defineArrayMember({ type: "mediaBlock" }),
    defineArrayMember({ type: "quoteBlock" }),
    defineArrayMember({ type: "timelineBlock" }),
    defineArrayMember({ type: "statsBlock" }),
    defineArrayMember({ type: "cardGridBlock" }),
    defineArrayMember({ type: "teamGridBlock" }),
    defineArrayMember({ type: "storyWorldGridBlock" }),
    defineArrayMember({ type: "newsListBlock" }),
    defineArrayMember({ type: "formEmbedBlock" }),
  ],
});
