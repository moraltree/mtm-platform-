import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { PageSections } from "@/components/patterns/PageSections";
import { getNewsPosts, getPageByPageId } from "@/lib/sanity/queries";
import { adaptSections } from "@/lib/pageSections";
import { urlFor } from "@/lib/sanity/image";
import { buildMetadata } from "@/lib/metadata";
import styles from "./page.module.css";

// An empty post list is a normal, expected state — like Leadership, not a
// 404 (unlike the pure-editorial pages).

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageByPageId("news");
  return buildMetadata(
    page?.seo?.metaTitle || page?.title || "News",
    page?.seo,
  );
}

export default async function NewsIndexPage() {
  const [page, posts] = await Promise.all([
    getPageByPageId("news"),
    getNewsPosts(),
  ]);
  const sections = adaptSections(page?.sections);
  const opensWithHero = sections[0]?._type === "heroBlock";

  return (
    <Container className={styles.wrap}>
      {!opensWithHero && <h1>{page?.title || "News"}</h1>}

      {page && <PageSections sections={sections} />}

      {posts && posts.length > 0 ? (
        <div className={styles.grid}>
          {posts.map((post) => {
            const coverSrc = post.coverImage
              ? urlFor(post.coverImage)?.width(800).url()
              : undefined;
            return (
              <Card
                key={post._id}
                title={post.title}
                body={post.excerpt}
                image={
                  coverSrc
                    ? { src: coverSrc, alt: post.coverImage?.alt || "" }
                    : undefined
                }
                href={`/news/${post.slug.current}`}
              />
            );
          })}
        </div>
      ) : (
        <p className={styles.empty}>No news posts yet — check back soon.</p>
      )}
    </Container>
  );
}
