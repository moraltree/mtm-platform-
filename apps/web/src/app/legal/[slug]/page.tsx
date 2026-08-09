import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { RichText } from "@/components/patterns/RichText";
import { getAllLegalPageSlugs, getLegalPageBySlug } from "@/lib/sanity/queries";
import { buildMetadata } from "@/lib/metadata";
import styles from "./page.module.css";

// Content lookup by slug — unlike the shell's site-wide chrome, a missing
// legal page IS a real 404, not something to paper over with a fallback.
export async function generateStaticParams() {
  const slugs = await getAllLegalPageSlugs();
  return (slugs ?? []).map(({ slug }) => ({ slug }));
}

export async function generateMetadata(
  props: PageProps<"/legal/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const page = await getLegalPageBySlug(slug);
  if (!page) return {};

  return buildMetadata(page.seo?.metaTitle || page.title, page.seo);
}

export default async function LegalPage(props: PageProps<"/legal/[slug]">) {
  const { slug } = await props.params;
  const page = await getLegalPageBySlug(slug);

  if (!page) notFound();

  return (
    <Container className={styles.wrap}>
      <p className={styles.date}>
        Effective{" "}
        {new Date(page.effectiveDate).toLocaleDateString("en-GB", {
          dateStyle: "long",
        })}
      </p>
      <h1>{page.title}</h1>
      <RichText value={page.body} width="wide" />
    </Container>
  );
}
