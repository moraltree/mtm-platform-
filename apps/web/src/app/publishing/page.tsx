import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageSections } from "@/components/patterns/PageSections";
import { PropositionShell } from "@/components/patterns/PropositionShell";
import { getPageByPageId } from "@/lib/sanity/queries";
import { adaptSections } from "@/lib/pageSections";
import { buildMetadata } from "@/lib/metadata";
import { BookIcon } from "./publishing-icons";

// Publishing used to share `lib/editorialPage.tsx` (About/Founder/Mission
// still do — pure editorial content, 404 on a missing `page` doc, see
// CLAUDE.md's null-handling rule 1). Owner decision (23 Aug 2026 QA pass):
// Publishing/Audiobooks/Animation move to their own honest "here's what
// we're building toward" shell instead — a real 404 here was actively
// wrong (these are live nav items, not unpublished editorial copy), and
// there's no fabricated-content risk in describing a proposition that's
// genuinely in development. A real Sanity `page` document, once one
// exists, still wins immediately (same "CMS wins the instant it exists"
// rule Home's own null-state established) — nothing to migrate by hand.

const FEATURES = [
  {
    title: "Physical children's books",
    body: "Printed picture books bringing each Story World to a child's bookshelf — the format our stories are built around first.",
  },
  {
    title: "Story World book collections",
    body: "Multiple titles per Story World, growing into a collectable set as each one develops — starting with Zulu the Zebra & The Savannah Seven.",
  },
  {
    title: "A browsable catalogue",
    body: "Once titles are ready, this page becomes a real catalogue — clickable covers linking through to each book's own page.",
  },
  {
    title: "Printable activities",
    body: "Downloadable and printable activity and colouring pages, designed alongside each book rather than added on afterwards.",
  },
];

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageByPageId("publishing");
  return buildMetadata(
    page?.seo?.metaTitle || page?.title || "Publishing",
    page?.seo,
  );
}

export default async function PublishingPage() {
  const page = await getPageByPageId("publishing");

  if (page) {
    const sections = adaptSections(page.sections);
    const opensWithHero = sections[0]?._type === "heroBlock";
    return (
      <>
        {!opensWithHero && (
          <Container>
            <h1>{page.title}</h1>
          </Container>
        )}
        <PageSections sections={sections} />
      </>
    );
  }

  return (
    <PropositionShell
      icon={<BookIcon />}
      eyebrow="Publishing"
      heading="Story World books, on the way"
      intro="We're building Moral Tree Media's publishing programme around physical, story-first children's books — starting with Zulu the Zebra & The Savannah Seven. Nothing is available to buy from this page yet; here's what we're working toward."
      features={FEATURES}
      comingSoonNote="No titles are published yet, so there's nothing to preview or purchase here. Once real books exist, this page becomes a genuine catalogue with real cover art and real availability — not a placeholder."
      ctas={[{ label: "Talk to us about publishing", href: "/contact" }]}
      secondaryLinks={[
        {
          label: "Meet the Savannah Seven",
          href: "/story-worlds/savannah-seven",
        },
      ]}
    />
  );
}
