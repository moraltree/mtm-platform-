import type { Metadata } from "next";
import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { PageSections } from "@/components/patterns/PageSections";
import { getLeadershipPeople, getPageByPageId } from "@/lib/sanity/queries";
import { adaptSections } from "@/lib/pageSections";
import { urlFor } from "@/lib/sanity/image";
import styles from "./page.module.css";

// An empty team list is a normal, expected state (the team's real size is
// whatever's authored), unlike the other editorial pages — no `page`
// document and no people means an honest empty state, not a 404.

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageByPageId("leadership");
  if (!page) return { title: "Leadership" };

  return {
    title: page.seo?.metaTitle || page.title,
    description: page.seo?.metaDescription,
    robots: page.seo?.noIndex ? { index: false, follow: false } : undefined,
  };
}

export default async function LeadershipPage() {
  const [page, people] = await Promise.all([
    getPageByPageId("leadership"),
    getLeadershipPeople(),
  ]);

  const sections = adaptSections(page?.sections);
  const opensWithHero = sections[0]?._type === "heroBlock";

  return (
    <Container className={styles.wrap}>
      {!opensWithHero && <h1>{page?.title || "Leadership"}</h1>}

      {page && <PageSections sections={sections} />}

      {people && people.length > 0 ? (
        <ul className={styles.grid}>
          {people.map((person) => {
            const photoUrl = person.photo
              ? urlFor(person.photo)?.width(400).height(400).url()
              : undefined;
            return (
              <li key={person._id} className={styles.card}>
                {photoUrl && (
                  <div className={styles.photo}>
                    <Image
                      src={photoUrl}
                      alt={person.photo?.alt || person.name}
                      fill
                      sizes="8rem"
                      className={styles.photoImage}
                    />
                  </div>
                )}
                <p className={styles.name}>{person.name}</p>
                <p className={styles.role}>{person.role}</p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.empty}>
          Our leadership team profiles are coming soon.
        </p>
      )}
    </Container>
  );
}
