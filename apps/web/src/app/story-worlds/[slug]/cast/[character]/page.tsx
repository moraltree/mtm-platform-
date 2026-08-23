import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { getStoryWorldBySlug, getStoryWorlds } from "@/lib/sanity/queries";
import { urlFor } from "@/lib/sanity/image";
import { buildMetadata } from "@/lib/metadata";
import { SHOP_URL, isShopConfigured } from "@/lib/shop";
import styles from "./page.module.css";

/**
 * The one reusable character-profile template, for any Story World's
 * roster — not eight hard-coded Savannah Seven layouts (24 Aug 2026
 * refinement sprint). Content lookup by two slugs (Story World, then
 * character within its `characterRoster`), so an unknown combination is
 * a real 404 — same rule as `/story-worlds/[slug]` itself and every
 * other by-slug lookup in this codebase.
 *
 * No character has real biography canon yet (species, personality,
 * strengths, likes, friendships, backstory, associated stories — see
 * `lib/characters.ts`'s own doc comment: "that canon doesn't exist in
 * this repository yet, and this file isn't the place to invent it").
 * Rather than add speculative Sanity schema fields for content that
 * doesn't exist, every narrative section below renders the same honest
 * placeholder until real copy exists — the structure is real, the
 * content isn't invented. `CharacterRosterEntry` only grew a routing
 * `slug` for this page, nothing narrative.
 */

const PROFILE_SECTIONS = [
  "Species",
  "Personality",
  "Role in the Savannah Seven",
  "Strengths & values",
  "Likes & interests",
  "Friendships & relationships",
  "Backstory",
  "Associated stories",
] as const;

const PLACEHOLDER_COPY = "Character profile coming soon.";

export async function generateStaticParams() {
  const storyWorlds = await getStoryWorlds();
  const params: Array<{ slug: string; character: string }> = [];
  for (const storyWorld of storyWorlds ?? []) {
    const full = await getStoryWorldBySlug(storyWorld.slug.current);
    for (const member of full?.characterRoster ?? []) {
      if (member.slug) {
        params.push({ slug: storyWorld.slug.current, character: member.slug });
      }
    }
  }
  return params;
}

export async function generateMetadata(
  props: PageProps<"/story-worlds/[slug]/cast/[character]">,
): Promise<Metadata> {
  const { slug, character } = await props.params;
  const storyWorld = await getStoryWorldBySlug(slug);
  const member = storyWorld?.characterRoster?.find((c) => c.slug === character);
  if (!storyWorld || !member) return {};

  return buildMetadata(`${member.name} — ${storyWorld.title}`, {
    metaDescription: `Meet ${member.name}, one of the cast of ${storyWorld.title}.`,
  });
}

export default async function CharacterProfilePage(
  props: PageProps<"/story-worlds/[slug]/cast/[character]">,
) {
  const { slug, character } = await props.params;
  const storyWorld = await getStoryWorldBySlug(slug);
  const member = storyWorld?.characterRoster?.find((c) => c.slug === character);

  if (!storyWorld || !member) notFound();

  const portraitSrc = urlFor(member.portrait)?.width(900).url();

  return (
    <>
      <Container className={styles.header}>
        <Link
          href={`/story-worlds/${storyWorld.slug.current}`}
          className={styles.back}
        >
          ← Back to {storyWorld.title}
        </Link>
        <div className={styles.headerLayout}>
          {portraitSrc && (
            <div className={styles.portrait}>
              <Image
                src={portraitSrc}
                alt={member.portrait?.alt || member.name}
                fill
                sizes="(min-width: 48rem) 20rem, 60vw"
                className={styles.portraitImage}
                priority
              />
            </div>
          )}
          <div className={styles.intro}>
            <h1>{member.name}</h1>
            <p className={styles.introBody}>
              One of the cast of {storyWorld.title}. A full introduction for{" "}
              {member.name} is coming as this Story World develops.
            </p>
            <div className={styles.ctaRow}>
              <Button href="/story-worlds/savannah-seven" variant="secondary">
                Meet the rest of the cast
              </Button>
              <Button href="/free30">Start your 30-day free trial</Button>
            </div>
          </div>
        </div>
      </Container>

      <Container className={styles.sections}>
        {PROFILE_SECTIONS.map((heading) => (
          <div key={heading} className={styles.section}>
            <h2 className={styles.sectionHeading}>{heading}</h2>
            <p className={styles.sectionBody}>{PLACEHOLDER_COPY}</p>
          </div>
        ))}
        <div className={styles.section}>
          <h2 className={styles.sectionHeading}>Merchandise & content</h2>
          <p className={styles.sectionBody}>
            {isShopConfigured
              ? `Merchandise featuring ${member.name} and the rest of the cast may appear in our shop as it grows.`
              : PLACEHOLDER_COPY}
          </p>
          {isShopConfigured && SHOP_URL && (
            <a
              href={SHOP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.shopLink}
            >
              Visit the shop ↗
            </a>
          )}
        </div>
      </Container>
    </>
  );
}
