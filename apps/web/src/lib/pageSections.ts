import type { PageSection } from "@/components/patterns/PageSections";
import { urlFor } from "./sanity/image";
import { resolveLink } from "./links";
import type { LinkField, RawSection, SanityImageRef } from "./sanity/types";

/**
 * Turns a page/Story World document's raw `sections` (GROQ output shaped
 * by queries.ts's SECTIONS_PROJECTION) into the typed, presentational
 * `PageSection[]` PageSections renders. One branch per pageBuilder member;
 * keep in sync with SECTIONS_PROJECTION and PageSections/types.ts by hand
 * — there's no schema-driven codegen tying the three together.
 *
 * Unresolvable sub-parts (a missing image, a link with no target) drop
 * that field rather than the whole section, except where the target
 * component requires it (e.g. Hero without a heading isn't renderable —
 * that shouldn't happen given the schema's required-field validation, but
 * defensively skips rather than crashes if it does).
 */
export function adaptSections(raw: RawSection[] | undefined): PageSection[] {
  if (!raw) return [];
  return raw.map(adaptSection).filter((s): s is PageSection => s !== null);
}

function adaptImage(
  image: unknown,
  alt?: string,
): { src: string; alt: string } | undefined {
  const src = urlFor(image as SanityImageRef)
    ?.width(1600)
    .url();
  if (!src) return undefined;
  const ref = image as SanityImageRef | undefined;
  return { src, alt: alt ?? ref?.alt ?? "" };
}

function adaptLinkList(
  links: unknown,
): Array<{ label: string; href: string; external?: boolean }> {
  if (!Array.isArray(links)) return [];
  return (links as LinkField[])
    .map(resolveLink)
    .filter((l): l is NonNullable<typeof l> => l !== null)
    .map((l) => ({ label: l.label, href: l.href, external: l.external }));
}

function adaptSection(section: RawSection): PageSection | null {
  const key = section._key;

  switch (section._type) {
    case "heroBlock": {
      if (!section.heading) return null;
      return {
        _type: "heroBlock",
        _key: key,
        eyebrow: section.eyebrow as string | undefined,
        heading: section.heading as string,
        subheading: section.subheading as string | undefined,
        media: adaptImage(section.media),
        ctas: adaptLinkList(section.ctas),
      };
    }

    case "richTextBlock": {
      if (!section.content) return null;
      return {
        _type: "richTextBlock",
        _key: key,
        value: section.content,
        width: section.width as "narrow" | "wide" | undefined,
      };
    }

    case "ctaPanelBlock": {
      const cta = resolveLink(section.cta as LinkField | undefined);
      if (!section.heading || !cta) return null;
      return {
        _type: "ctaPanelBlock",
        _key: key,
        heading: section.heading as string,
        body: section.body as string | undefined,
        cta: { label: cta.label, href: cta.href, external: cta.external },
        tone: section.tone as "primary" | "neutral" | undefined,
      };
    }

    case "mediaBlock": {
      const caption = section.caption as string | undefined;
      const fullBleed = section.fullBleed as boolean | undefined;
      if (section.mediaType === "video" && section.videoUrl) {
        return {
          _type: "mediaBlock",
          _key: key,
          type: "video",
          videoUrl: section.videoUrl as string,
          caption,
          fullBleed,
        };
      }
      const image = adaptImage(section.image);
      if (!image) return null;
      return {
        _type: "mediaBlock",
        _key: key,
        type: "image",
        image,
        caption,
        fullBleed,
      };
    }

    case "quoteBlock": {
      if (!section.quote) return null;
      return {
        _type: "quoteBlock",
        _key: key,
        quote: section.quote as string,
        attribution: section.attribution as string | undefined,
        role: section.role as string | undefined,
      };
    }

    case "timelineBlock": {
      const entries = Array.isArray(section.entries) ? section.entries : [];
      if (entries.length === 0) return null;
      return {
        _type: "timelineBlock",
        _key: key,
        heading: section.heading as string | undefined,
        entries: entries as Array<{
          date: string;
          title: string;
          body?: string;
        }>,
      };
    }

    case "statsBlock": {
      const stats = Array.isArray(section.stats) ? section.stats : [];
      if (stats.length === 0) return null;
      return {
        _type: "statsBlock",
        _key: key,
        heading: section.heading as string | undefined,
        stats: stats as Array<{ value: string; label: string }>,
      };
    }

    case "cardGridBlock": {
      const rawCards = Array.isArray(section.cards) ? section.cards : [];
      const cards = rawCards
        .map((card: Record<string, unknown>) => {
          if (!card.title) return null;
          const link = resolveLink(card.link as LinkField | undefined);
          return {
            title: card.title as string,
            body: card.body as string | undefined,
            image: adaptImage(card.image),
            href: link?.href,
          };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null);
      if (cards.length === 0) return null;
      return {
        _type: "cardGridBlock",
        _key: key,
        heading: section.heading as string | undefined,
        columns: section.columns as 2 | 3 | 4 | undefined,
        cards,
      };
    }

    case "formEmbedBlock": {
      if (section.form !== "contact") return null;
      return {
        _type: "formEmbedBlock",
        _key: key,
        form: "contact",
        heading: section.heading as string | undefined,
        intro: section.intro as string | undefined,
      };
    }

    // Data-driven — PageSections no-ops on these (see its switch
    // statement for why); pass the _type/_key through unchanged.
    case "teamGridBlock":
      return { _type: "teamGridBlock", _key: key };
    case "storyWorldGridBlock":
      return { _type: "storyWorldGridBlock", _key: key };
    case "newsListBlock":
      return { _type: "newsListBlock", _key: key };

    default:
      return null;
  }
}
