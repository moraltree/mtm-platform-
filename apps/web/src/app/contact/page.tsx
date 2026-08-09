import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { ContactForm } from "@/components/patterns/ContactForm";
import { PageSections } from "@/components/patterns/PageSections";
import { getPageByPageId } from "@/lib/sanity/queries";
import { adaptSections } from "@/lib/pageSections";

// Contact is a utility page, not pure editorial content — being reachable
// matters more than being CMS-authored, so unlike About/Founder/Mission
// etc. a missing `page` document renders a generic form instead of 404ing.

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageByPageId("contact");
  if (!page) return { title: "Contact" };

  return {
    title: page.seo?.metaTitle || page.title,
    description: page.seo?.metaDescription,
    robots: page.seo?.noIndex ? { index: false, follow: false } : undefined,
  };
}

export default async function ContactPage() {
  const page = await getPageByPageId("contact");
  const sections = adaptSections(page?.sections);
  const opensWithHero = sections[0]?._type === "heroBlock";
  // A formEmbedBlock authored in `sections` already supplies the form
  // (with editorial heading/intro copy) — don't render a second, generic
  // one underneath it.
  const hasFormSection = sections.some((s) => s._type === "formEmbedBlock");

  return (
    <>
      {!opensWithHero && (
        <Container>
          <h1>{page?.title || "Contact"}</h1>
        </Container>
      )}
      {page && <PageSections sections={sections} />}
      {!hasFormSection && (
        <ContactForm heading={page ? undefined : "Get in touch"} />
      )}
    </>
  );
}
