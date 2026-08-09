import type { LinkField, PageId } from "./sanity/types";

/**
 * Canonical URL for each fixed `pageId` — kept in sync with
 * apps/studio/schemaTypes/documents/page.ts's `pageId` options and
 * apps/studio/structure.ts's PAGE_IDS. WP5/WP6 route folders must match
 * these paths.
 */
export const PAGE_ID_PATHS: Record<PageId, string> = {
  home: "/",
  about: "/about",
  founder: "/founder",
  leadership: "/leadership",
  mission: "/mission",
  publishing: "/publishing",
  audiobooks: "/audiobooks",
  animation: "/animation",
  contact: "/contact",
  "story-worlds": "/story-worlds",
};

export interface ResolvedLink {
  label: string;
  href: string;
  external: boolean;
  openInNewTab?: boolean;
}

/**
 * Turns a Sanity `link` field into a real href, or `null` if it can't be
 * resolved (missing target/slug) — callers should skip rendering rather
 * than emit a dead link. Requires `internalRef` to already be dereferenced
 * (see queries.ts's LINK_PROJECTION); a raw `{_ref}` pointer won't resolve.
 */
export function resolveLink(
  link: LinkField | null | undefined,
): ResolvedLink | null {
  if (!link) return null;

  if (link.type === "external") {
    if (!link.externalUrl) return null;
    return {
      label: link.label,
      href: link.externalUrl,
      external: true,
      openInNewTab: link.openInNewTab,
    };
  }

  const ref = link.internalRef;
  if (!ref) return null;

  switch (ref._type) {
    case "page": {
      const path = ref.pageId ? PAGE_ID_PATHS[ref.pageId] : undefined;
      return path ? { label: link.label, href: path, external: false } : null;
    }
    case "storyWorld":
      return ref.slug
        ? {
            label: link.label,
            href: `/story-worlds/${ref.slug}`,
            external: false,
          }
        : null;
    case "newsPost":
      return ref.slug
        ? { label: link.label, href: `/news/${ref.slug}`, external: false }
        : null;
    case "legalPage":
      return ref.slug
        ? { label: link.label, href: `/legal/${ref.slug}`, external: false }
        : null;
    default:
      return null;
  }
}

/** Resolves a list of links, dropping any that don't resolve. */
export function resolveLinks(
  links: LinkField[] | null | undefined,
): ResolvedLink[] {
  if (!links) return [];
  return links
    .map(resolveLink)
    .filter((link): link is ResolvedLink => link !== null);
}
