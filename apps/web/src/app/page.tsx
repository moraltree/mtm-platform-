import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageSections } from "@/components/patterns/PageSections";
import { getPageByPageId } from "@/lib/sanity/queries";
import { adaptSections } from "@/lib/pageSections";
import { buildMetadata } from "@/lib/metadata";

// Home is the site's front door — unlike the pure-editorial pages, a
// missing `page` document falls back to a plain, honest placeholder
// (not fabricated marketing copy, not a 404) rather than leaving the
// domain root broken before any content exists.

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageByPageId("home");
  if (!page) return {};

  // No `page.title` fallback here (unlike other routes): the default
  // "Moral Tree Media" (root layout) should stand bare on the homepage,
  // not become "Home | Moral Tree Media".
  return buildMetadata(page.seo?.metaTitle, page.seo);
}

export default async function Home() {
  const page = await getPageByPageId("home");

  if (!page) {
    return (
      <Container>
        <h1>Moral Tree Media</h1>
        <p>
          Site foundation is live. Content lands here as each work package ships
          — see the project README for status.
        </p>
      </Container>
    );
  }

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
