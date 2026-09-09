import type { ResolvedLink } from "./links";
import { PAGE_ID_PATHS } from "./links";
import { SHOP_URL, isShopConfigured } from "./shop";

/**
 * Fallback global chrome used whenever `getSiteSettings()` returns `null`
 * — true in every environment right now, since no real Sanity project
 * exists. This is a *different* rule from "treat null as a real error"
 * (CLAUDE.md): that applies to page-level content lookups (a specific
 * page/Story World/news post/legal page by id or slug), not site-wide
 * chrome, which needs to work before any content exists at all.
 */
export const DEFAULT_SITE_TITLE = "Moral Tree Media";

/**
 * "Shop" links out to the Shopify-hosted storefront (`lib/shop.ts`), not
 * the legacy internal `/shop` route — omitted entirely rather than
 * falling back to that route when `NEXT_PUBLIC_SHOP_URL` is unset (see
 * `lib/shop.ts`'s doc comment). If/when a real Sanity `siteSettings`
 * project supplies its own primary nav instead of this fallback, the same
 * decision needs applying there too — not done here, out of scope until
 * that project exists.
 */
export const DEFAULT_PRIMARY_NAV: ResolvedLink[] = [
  { label: "About", href: PAGE_ID_PATHS.about, external: false },
  {
    label: "Story Worlds",
    href: PAGE_ID_PATHS["story-worlds"],
    external: false,
  },
  { label: "Publishing", href: PAGE_ID_PATHS.publishing, external: false },
  { label: "Audiobooks", href: PAGE_ID_PATHS.audiobooks, external: false },
  { label: "Animation", href: PAGE_ID_PATHS.animation, external: false },
  ...(isShopConfigured
    ? [{ label: "Shop", href: SHOP_URL as string, external: true }]
    : []),
  { label: "News", href: PAGE_ID_PATHS.news, external: false },
  { label: "Contact", href: PAGE_ID_PATHS.contact, external: false },
];

export const DEFAULT_FOOTER_NOTE = `© ${new Date().getFullYear()} Moral Tree Media. All rights reserved.`;

export const DEFAULT_DESCRIPTION =
  "Moral Tree Media develops Story Worlds across publishing, audiobooks, and animation.";
