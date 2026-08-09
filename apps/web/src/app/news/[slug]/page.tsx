import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { RichText } from "@/components/patterns/RichText";
import { getNewsPostBySlug, getNewsPosts } from "@/lib/sanity/queries";
import { buildMetadata } from "@/lib/metadata";
import styles from "./page.module.css";

export async function generateStaticParams() {
  const posts = await getNewsPosts(100);
  return (posts ?? []).map((post) => ({ slug: post.slug.current }));
}

export async function generateMetadata(
  props: PageProps<"/news/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const post = await getNewsPostBySlug(slug);
  if (!post) return {};

  return buildMetadata(post.seo?.metaTitle || post.title, {
    ...post.seo,
    metaDescription: post.seo?.metaDescription || post.excerpt,
  });
}

export default async function NewsPostPage(props: PageProps<"/news/[slug]">) {
  const { slug } = await props.params;
  const post = await getNewsPostBySlug(slug);

  if (!post) notFound();

  return (
    <Container className={styles.wrap}>
      <p className={styles.date}>
        {new Date(post.publishedAt).toLocaleDateString("en-GB", {
          dateStyle: "long",
        })}
      </p>
      <h1>{post.title}</h1>
      <RichText value={post.body} width="wide" />
    </Container>
  );
}
