import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageSections } from "@/components/patterns/PageSections";
import { PropositionShell } from "@/components/patterns/PropositionShell";
import { getPageByPageId } from "@/lib/sanity/queries";
import { adaptSections } from "@/lib/pageSections";
import { buildMetadata } from "@/lib/metadata";
import { HeadphonesIcon } from "./audiobooks-icons";

// See publishing/page.tsx's doc comment for why this no longer uses
// `lib/editorialPage.tsx` (404-on-missing-doc) — same owner decision,
// same "CMS wins the instant a real `page` document exists" fallback
// order.
//
// Deliberately does NOT build or embed a real audio player: no actual
// audio production/TTS integration exists yet (a separate, explicitly
// deferred platform — see CLAUDE.md's guidance for future sessions), so
// a fake `<audio>` element pointing at nothing would be worse than this
// honest "samples are coming" note. `/free30` (the one real, working
// piece of the trial funnel that already exists) is linked directly
// rather than re-described here.

const FEATURES = [
  {
    title: "Bedtime audio stories",
    body: "Narrated stories designed for the end of the day — the same Story World characters and moral centre as the books, told aloud.",
  },
  {
    title: "One Story World, one voice",
    body: "Each audiobook stays connected to its Story World, so families can move between reading and listening to the same characters.",
  },
  {
    title: "Sample stories to try first",
    body: "Featured samples will let you hear a story before subscribing — see the note below for where that stands today.",
  },
  {
    title: "Subscriber access",
    body: 'A subscription will unlock the full library as it grows. Subscribing isn\'t live yet — see "Subscribe" below.',
  },
];

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageByPageId("audiobooks");
  return buildMetadata(
    page?.seo?.metaTitle || page?.title || "Audiobooks",
    page?.seo,
  );
}

export default async function AudiobooksPage() {
  const page = await getPageByPageId("audiobooks");

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
      icon={<HeadphonesIcon />}
      eyebrow="Audiobooks"
      heading="Bedtime stories, read aloud"
      intro="Moral Tree Media's audiobooks bring each Story World to bedtime as narrated audio. Audio production hasn't started yet, so there are no playable samples on this page today — here's what we're building toward, and one real way to get involved now."
      features={FEATURES}
      comingSoonNote="No audio has been produced yet, so this page can't offer a real sample player without pretending something exists that doesn't. Once featured samples are ready, they'll play directly from this page. In the meantime, the 30-day free trial below is real and already takes real sign-ups."
      ctas={[
        { label: "Start your 30-day free trial", href: "/free30" },
        { label: "Subscribe", href: "/contact", variant: "secondary" },
      ]}
    />
  );
}
