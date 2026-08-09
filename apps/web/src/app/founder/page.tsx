import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { RichText } from "@/components/patterns/RichText";
import { PageSections } from "@/components/patterns/PageSections";
import { getFounder, getPageByPageId } from "@/lib/sanity/queries";
import { adaptSections } from "@/lib/pageSections";
import { urlFor } from "@/lib/sanity/image";
import { buildMetadata } from "@/lib/metadata";
import { resolveInternalRef } from "@/lib/links";
import styles from "./page.module.css";

// Founder is a `page` document (optional intro sections) plus the
// `person` document flagged `isFounder` (structured profile: photo, role,
// bio) — the schema keeps these separate on purpose (see WP2/CLAUDE.md's
// person.ts), so this route is bespoke rather than going through
// lib/editorialPage.tsx like the other single-purpose pages.

export async function generateMetadata(): Promise<Metadata> {
  const [page, founder] = await Promise.all([
    getPageByPageId("founder"),
    getFounder(),
  ]);
  if (!page && !founder) return {};

  const title = page?.seo?.metaTitle || page?.title || founder?.name;
  return buildMetadata(title, page?.seo);
}

export default async function FounderPage() {
  const [page, founder] = await Promise.all([
    getPageByPageId("founder"),
    getFounder(),
  ]);

  // Both null: there's genuinely nothing to render — a real 404, same
  // rule as any other editorial content lookup.
  if (!page && !founder) notFound();

  const sections = adaptSections(page?.sections);
  const opensWithHero = sections[0]?._type === "heroBlock";
  const title = page?.title ?? founder?.name ?? "Founder";
  const photoUrl = founder?.photo
    ? urlFor(founder.photo)?.width(480).height(480).url()
    : undefined;

  return (
    <>
      {!opensWithHero && (
        <Container>
          <h1>{title}</h1>
        </Container>
      )}

      {page && <PageSections sections={sections} />}

      {founder && (
        <Container as="section" className={styles.profile}>
          {photoUrl && (
            <div className={styles.photo}>
              <Image
                src={photoUrl}
                alt={founder.photo?.alt || founder.name}
                fill
                sizes="12rem"
                className={styles.photoImage}
              />
            </div>
          )}
          <div>
            <p className={styles.role}>{founder.role}</p>
            {founder.bio && (
              <RichText
                value={founder.bio}
                resolveInternalLink={resolveInternalRef}
              />
            )}
          </div>
        </Container>
      )}
    </>
  );
}
