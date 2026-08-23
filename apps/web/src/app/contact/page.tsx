import type { Metadata } from "next";
import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { ContactForm } from "@/components/patterns/ContactForm";
import { PageSections } from "@/components/patterns/PageSections";
import { getPageByPageId } from "@/lib/sanity/queries";
import { adaptSections } from "@/lib/pageSections";
import { buildMetadata } from "@/lib/metadata";
import { getCharacterPose } from "@/lib/characters";
import styles from "./contact.module.css";

// Contact is a utility page, not pure editorial content — being reachable
// matters more than being CMS-authored, so unlike About/Founder/Mission
// etc. a missing `page` document renders a generic form instead of 404ing.

// Flanking decorative imagery for the fallback (no real Sanity `page`
// doc) rendering only — 24 Aug 2026 refinement sprint, "the layout works
// but is sparse." A real `page` document's own `sections` (PageSections
// below) stay untouched by this — an editor controls that composition
// fully once real content exists. Zulu's own welcoming wave pose, not
// invented "contact" artwork.
const CONTACT_CHARACTER_IMAGE = getCharacterPose("zulu", "three-quarter-wave");

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageByPageId("contact");
  return buildMetadata(
    page?.seo?.metaTitle || page?.title || "Contact",
    page?.seo,
  );
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
      {!hasFormSection &&
        (page ? (
          <ContactForm />
        ) : (
          // Not a Container here — ContactForm already renders its own
          // (Container/Container.tsx nesting would double the inline
          // padding). This is a full-width flex row instead; the form's
          // own Container still centers and caps it correctly in the
          // middle, the flanking images just sit either side of that at
          // the viewport edges.
          <div className={styles.layout}>
            <div className={styles.flank} aria-hidden="true">
              <Image
                src="/images/brand/moral-tree-mark.png"
                alt=""
                fill
                sizes="(min-width: 64rem) 10rem, 0px"
              />
            </div>
            <ContactForm heading="Get in touch" />
            <div className={styles.flank} aria-hidden="true">
              {CONTACT_CHARACTER_IMAGE && (
                <Image
                  src={CONTACT_CHARACTER_IMAGE.path}
                  alt=""
                  fill
                  sizes="(min-width: 64rem) 10rem, 0px"
                  className={styles.flankContain}
                />
              )}
            </div>
          </div>
        ))}
    </>
  );
}
