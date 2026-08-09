import type { StructureResolver } from "sanity/structure";

// Fixed corporate/capability pages — kept in sync with the `pageId` option
// list in schemaTypes/documents/page.ts.
const PAGE_IDS: Array<{ id: string; title: string }> = [
  { id: "home", title: "Home" },
  { id: "about", title: "About" },
  { id: "founder", title: "Founder" },
  { id: "leadership", title: "Leadership" },
  { id: "mission", title: "Mission" },
  { id: "publishing", title: "Publishing" },
  { id: "audiobooks", title: "Audiobooks" },
  { id: "animation", title: "Animation" },
  { id: "contact", title: "Contact" },
  { id: "news", title: "News index" },
  { id: "story-worlds", title: "Story Worlds index" },
];

export const structure: StructureResolver = (S) =>
  S.list()
    .title("Content")
    .items([
      S.listItem()
        .title("Site settings")
        .child(
          S.document().schemaType("siteSettings").documentId("siteSettings"),
        ),
      S.divider(),
      S.listItem()
        .title("Pages")
        .child(
          S.list()
            .title("Pages")
            .items(
              PAGE_IDS.map(({ id, title }) =>
                S.listItem()
                  .title(title)
                  .child(
                    S.document()
                      .schemaType("page")
                      .documentId(`page-${id}`)
                      .initialValueTemplate("pageWithId", { pageId: id }),
                  ),
              ),
            ),
        ),
      S.divider(),
      S.documentTypeListItem("storyWorld").title("Story Worlds"),
      S.documentTypeListItem("newsPost").title("News"),
      S.documentTypeListItem("person").title("People"),
      S.documentTypeListItem("legalPage").title("Legal pages"),
    ]);
