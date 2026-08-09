import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { PageSections } from "@/components/patterns/PageSections";
import { getPageByPageId } from "@/lib/sanity/queries";
import { adaptSections } from "@/lib/pageSections";
import type { PageId } from "@/lib/sanity/types";

/**
 * Shared implementation for every single-purpose editorial page (About,
 * Founder, Mission, Publishing, Audiobooks, Animation) — each route's
 * page.tsx is a few lines calling this with its own fixed `pageId`. A
 * missing `page` document is a real 404 here (not the site-chrome fallback
 * rule): these are pure editorial content with no honest non-fabricated
 * placeholder to fall back to. See CLAUDE.md.
 */

export async function generateEditorialMetadata(
  pageId: PageId,
): Promise<Metadata> {
  const page = await getPageByPageId(pageId);
  if (!page) return {};

  return {
    title: page.seo?.metaTitle || page.title,
    description: page.seo?.metaDescription,
    robots: page.seo?.noIndex ? { index: false, follow: false } : undefined,
  };
}

export async function EditorialPage({ pageId }: { pageId: PageId }) {
  const page = await getPageByPageId(pageId);
  if (!page) notFound();

  const sections = adaptSections(page.sections);
  // Hero already renders its own <h1> — only fall back to a plain title
  // here when the page doesn't open with one, so there's never a second,
  // redundant <h1> on the page.
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
