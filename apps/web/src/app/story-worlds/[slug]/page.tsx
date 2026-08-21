import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { RichText } from "@/components/patterns/RichText";
import { PageSections } from "@/components/patterns/PageSections";
import { getStoryWorldBySlug, getStoryWorlds } from "@/lib/sanity/queries";
import { adaptSections } from "@/lib/pageSections";
import { urlFor } from "@/lib/sanity/image";
import { buildMetadata } from "@/lib/metadata";
import styles from "./page.module.css";

// The one reusable template for every Story World — content lookup by
// slug, so a missing document is a real 404 (same rule as About/Founder/
// etc., not the listing-page rule the index above uses).

const FORMAT_LABELS: Record<string, string> = {
  publishing: "Publishing",
  audiobooks: "Audiobooks",
  animation: "Animation",
};

const STATUS_LABELS: Record<string, string> = {
  "in-development": "In development",
  released: "Released",
  announced: "Announced",
};

export async function generateStaticParams() {
  const storyWorlds = await getStoryWorlds();
  return (storyWorlds ?? []).map((storyWorld) => ({
    slug: storyWorld.slug.current,
  }));
}

export async function generateMetadata(
  props: PageProps<"/story-worlds/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const storyWorld = await getStoryWorldBySlug(slug);
  if (!storyWorld) return {};

  return buildMetadata(storyWorld.seo?.metaTitle || storyWorld.title, {
    ...storyWorld.seo,
    metaDescription: storyWorld.seo?.metaDescription || storyWorld.tagline,
  });
}

export default async function StoryWorldPage(
  props: PageProps<"/story-worlds/[slug]">,
) {
  const { slug } = await props.params;
  const storyWorld = await getStoryWorldBySlug(slug);

  if (!storyWorld) notFound();

  const heroSrc = urlFor(storyWorld.heroImage)?.width(1600).url();
  const sections = adaptSections(storyWorld.sections);

  return (
    <>
      <Container className={styles.header}>
        {(storyWorld.status ||
          (storyWorld.formats && storyWorld.formats.length > 0)) && (
          <div className={styles.badges}>
            {storyWorld.status && (
              <Badge tone="brand">
                {STATUS_LABELS[storyWorld.status] ?? storyWorld.status}
              </Badge>
            )}
            {storyWorld.formats?.map((format) => (
              <Badge key={format}>{FORMAT_LABELS[format] ?? format}</Badge>
            ))}
          </div>
        )}
        <h1>{storyWorld.title}</h1>
        {storyWorld.tagline && (
          <p className={styles.tagline}>{storyWorld.tagline}</p>
        )}
      </Container>

      {heroSrc && (
        <div className={styles.hero}>
          <Image
            src={heroSrc}
            alt={storyWorld.heroImage.alt || ""}
            fill
            sizes="100vw"
            className={styles.heroImage}
            priority
          />
        </div>
      )}

      {storyWorld.synopsis && (
        <Container className={styles.synopsis}>
          <RichText value={storyWorld.synopsis} />
        </Container>
      )}

      {storyWorld.gallery && storyWorld.gallery.length > 0 && (
        <Container className={styles.gallery}>
          {storyWorld.gallery.map((image, index) => {
            const src = urlFor(image)?.width(1200).url();
            if (!src) return null;
            return (
              <div key={image._key ?? index} className={styles.galleryItem}>
                <Image
                  src={src}
                  alt={image.alt || ""}
                  fill
                  sizes="(min-width: 48rem) 33vw, 100vw"
                  className={styles.galleryImage}
                />
              </div>
            );
          })}
        </Container>
      )}

      {storyWorld.characterRoster && storyWorld.characterRoster.length > 0 && (
        <Container className={styles.characters}>
          <h2 className={styles.charactersHeading}>Meet the cast</h2>
          <div className={styles.characterGrid}>
            {storyWorld.characterRoster.map((member, index) => {
              const src = urlFor(member.portrait)?.width(300).url();
              return (
                <div
                  key={member.name ?? index}
                  className={styles.characterCard}
                >
                  {src && (
                    <div className={styles.characterPortrait}>
                      <Image
                        src={src}
                        alt={member.portrait?.alt || member.name}
                        fill
                        sizes="8rem"
                        className={styles.characterImage}
                      />
                    </div>
                  )}
                  <p className={styles.characterName}>{member.name}</p>
                </div>
              );
            })}
          </div>
        </Container>
      )}

      <PageSections sections={sections} />
    </>
  );
}
