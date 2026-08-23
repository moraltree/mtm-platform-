import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageSections } from "@/components/patterns/PageSections";
import { PropositionShell } from "@/components/patterns/PropositionShell";
import { getPageByPageId } from "@/lib/sanity/queries";
import { adaptSections } from "@/lib/pageSections";
import { buildMetadata } from "@/lib/metadata";
import { FilmIcon } from "./animation-icons";

// See publishing/page.tsx's doc comment for why this no longer uses
// `lib/editorialPage.tsx` (404-on-missing-doc) — same owner decision,
// same "CMS wins the instant a real `page` document exists" fallback
// order. No animation has been produced — this page describes the
// capability, it doesn't demonstrate it (no embedded video, no claim
// that a TV series or film exists).

const FEATURES = [
  {
    title: "Short Story World clips",
    body: "10-30 second animated moments bringing a Story World's characters to life in motion, not full episodes.",
  },
  {
    title: "One capability, every Story World",
    body: "The same short-form animation approach works across Story Worlds as each one develops, not a one-off for a single title.",
  },
  {
    title: "Connected to the books",
    body: "Animation designed to sit alongside physical and digital books, not replace them — the same characters, extended into motion.",
  },
  {
    title: "QR-triggered scenes",
    body: "A future way to scan a page in a physical book and watch that moment come to life — building on the QR/short-link system already used elsewhere on this site.",
  },
];

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageByPageId("animation");
  return buildMetadata(
    page?.seo?.metaTitle || page?.title || "Animation",
    page?.seo,
  );
}

export default async function AnimationPage() {
  const page = await getPageByPageId("animation");

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
      icon={<FilmIcon />}
      eyebrow="Animation"
      heading="Story Worlds, in motion"
      intro="Animation is the third medium in our cross-media plan, alongside books and audio — short clips that bring each Story World's characters to life, with a longer-term ambition toward television and film. No animation has been produced yet, so there's nothing to watch on this page today."
      features={FEATURES}
      comingSoonNote="This page describes where animation is headed, not what exists — there are no clips to watch yet, and we're not claiming a TV series or film is in production. That's a genuine future ambition, not a current one."
      ctas={[{ label: "Talk to us about animation", href: "/contact" }]}
      secondaryLinks={[
        {
          label: "Meet the Savannah Seven",
          href: "/story-worlds/savannah-seven",
        },
      ]}
    />
  );
}
