import type { Metadata } from "next";
import type { SeoFields } from "./sanity/types";

/**
 * Builds a route's Metadata from optional SEO fields, omitting keys
 * entirely when there's no value to set.
 *
 * This matters more than it looks: Next's metadata merging treats a key's
 * mere *presence* in a segment's returned object — even set to `undefined`
 * — as "this segment defines this field", which drops the root layout's
 * default for that field rather than inheriting it (see generate-
 * metadata.md's "Merging"/"Inheriting fields" sections). A page whose `seo`
 * has no `metaDescription` doing `{ description: seo?.metaDescription }`
 * silently wipes the site-wide default description instead of inheriting
 * it. Every route's generateMetadata should go through this rather than
 * building the object by hand.
 */
export function buildMetadata(
  title: string | undefined,
  seo: SeoFields | undefined,
): Metadata {
  const metadata: Metadata = {};
  if (title) metadata.title = title;
  if (seo?.metaDescription) metadata.description = seo.metaDescription;
  if (seo?.noIndex) metadata.robots = { index: false, follow: false };
  return metadata;
}
