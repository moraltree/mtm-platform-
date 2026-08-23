import type { Metadata } from "next";
import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { ContactForm } from "@/components/patterns/ContactForm";
import { PageSections } from "@/components/patterns/PageSections";
import { BrandMark } from "@/components/patterns/BrandMark";
import { getPageByPageId } from "@/lib/sanity/queries";
import { adaptSections } from "@/lib/pageSections";
import { buildMetadata } from "@/lib/metadata";
import { getCharacterPose } from "@/lib/characters";
import { parseEnquiryType } from "@/lib/enquiryTypes";
import styles from "./contact.module.css";

// Contact is a utility page, not pure editorial content — being reachable
// matters more than being CMS-authored, so unlike About/Founder/Mission
// etc. a missing `page` document renders a generic form instead of 404ing.

// Flanking decorative imagery for the fallback (no real Sanity `page`
// doc) rendering only — 24 Aug 2026 refinement sprint, "the layout works
// but is sparse." A real `page` document's own `sections` (PageSections
// below) stay untouched by this — an editor controls that composition
// fully once real content exists.
//
// Lulu, not Zulu (23 Aug 2026's own first pass used Zulu's wave pose
// here — this sprint's brief flagged that as "the repeated waving-Zulu
// artwork is overused" and explicitly suggested Lulu instead): part of
// the site-wide push for cast variety on secondary pages (see
// CLAUDE.md), not invented "contact" artwork — still one of the eight
// approved website poses.
const CONTACT_CHARACTER_IMAGE = getCharacterPose("lulu", "front-portrait");

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageByPageId("contact");
  return buildMetadata(
    page?.seo?.metaTitle || page?.title || "Contact",
    page?.seo,
  );
}

export default async function ContactPage(props: PageProps<"/contact">) {
  const searchParams = await props.searchParams;
  const typeParam = searchParams.type;
  // The badge only ever shows for a *real* known, non-general type — an
  // unrecognised/missing `?type=` degrades all the way to `undefined`
  // here (no badge at all), not a fabricated "General enquiry" label
  // nobody asked for. See lib/enquiryTypes.ts.
  const parsedEnquiryType =
    typeof typeParam === "string" ? parseEnquiryType(typeParam) : undefined;
  const enquiryType =
    parsedEnquiryType === "general" ? undefined : parsedEnquiryType;

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
          <ContactForm enquiryType={enquiryType} />
        ) : (
          // Not a Container here — ContactForm already renders its own
          // (Container/Container.tsx nesting would double the inline
          // padding). This is a full-width flex row instead; the form's
          // own Container still centers and caps it correctly in the
          // middle, the flanking images just sit either side of that at
          // the viewport edges.
          <div className={styles.layout}>
            <BrandMark
              className={styles.flankBrand}
              sizes="(min-width: 64rem) 15rem, 0px"
            />
            <ContactForm heading="Get in touch" enquiryType={enquiryType} />
            <div className={styles.flank} aria-hidden="true">
              {CONTACT_CHARACTER_IMAGE && (
                <Image
                  src={CONTACT_CHARACTER_IMAGE.path}
                  alt=""
                  fill
                  sizes="(min-width: 64rem) 15rem, 0px"
                />
              )}
            </div>
          </div>
        ))}
    </>
  );
}
