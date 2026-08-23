import type { Metadata } from "next";
import Image from "next/image";
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
        <div className={styles.empty}>
          {/* The Moral Tree symbol, not invented "news" imagery — a
              tasteful visual anchor for an honestly-empty page, same
              approved brand asset used on About/free30 (see
              public/images/brand/README.md). */}
          <div className={styles.emptyVisual} aria-hidden="true">
            <Image
              src="/images/brand/moral-tree-mark.png"
              alt=""
              fill
              sizes="8rem"
            />
          </div>
          <div>
            <h2 className={styles.emptyHeading}>Updates coming soon</h2>
            <p className={styles.emptyBody}>
              We haven&rsquo;t published any announcements yet. Real news from
              Moral Tree Media — Story World milestones, publishing and
              audiobook updates, and press coverage — will appear here as it
              happens.
            </p>
          </div>
        </div>
      )}
    </Container>
  );
}
