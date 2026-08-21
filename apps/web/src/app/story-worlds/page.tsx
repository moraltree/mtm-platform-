import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageSections } from "@/components/patterns/PageSections";
import { getPageByPageId, getStoryWorlds } from "@/lib/sanity/queries";
import { adaptSections } from "@/lib/pageSections";
import { urlFor } from "@/lib/sanity/image";
import { buildMetadata } from "@/lib/metadata";
import styles from "./page.module.css";

// Listing page — an empty catalogue is a normal state (like Leadership/
// News), not a 404.

// Mirrors story-worlds/[slug]/page.tsx's own STATUS_LABELS — kept as a
// separate, tiny copy rather than a shared import across route files.
const STATUS_LABELS: Record<string, string> = {
  "in-development": "In development",
  released: "Released",
  announced: "Announced",
};

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageByPageId("story-worlds");
  return buildMetadata(
    page?.seo?.metaTitle || page?.title || "Story Worlds",
    page?.seo,
  );
}

export default async function StoryWorldsIndexPage() {
  const [page, storyWorlds] = await Promise.all([
    getPageByPageId("story-worlds"),
    getStoryWorlds(),
  ]);
  const sections = adaptSections(page?.sections);
  const opensWithHero = sections[0]?._type === "heroBlock";

  return (
    <Container className={styles.wrap}>
      {!opensWithHero && <h1>{page?.title || "Story Worlds"}</h1>}

      {page && <PageSections sections={sections} />}

      {storyWorlds && storyWorlds.length > 0 ? (
        <div className={styles.grid}>
          {storyWorlds.map((storyWorld) => {
            const imageSrc = urlFor(storyWorld.heroImage)?.width(800).url();
            return (
              <Card
                key={storyWorld._id}
                title={storyWorld.title}
                meta={
                  storyWorld.status && (
                    <Badge tone="brand">
                      {STATUS_LABELS[storyWorld.status] ?? storyWorld.status}
                    </Badge>
                  )
                }
                body={storyWorld.tagline}
                image={
                  imageSrc
                    ? { src: imageSrc, alt: storyWorld.heroImage.alt || "" }
                    : undefined
                }
                href={`/story-worlds/${storyWorld.slug.current}`}
              />
            );
          })}
        </div>
      ) : (
        <p className={styles.empty}>Story Worlds are coming soon.</p>
      )}
    </Container>
  );
}
