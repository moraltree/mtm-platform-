import type { MetadataRoute } from "next";
import { getAllLegalPageSlugs } from "@/lib/sanity/queries";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Kept in sync by hand with the Phase One route list — none of WP5/WP6's
// page routes exist yet, so this only lists what's actually live plus
// whatever legal content is real. Extend as each WP lands its routes.
const STATIC_ROUTES = ["/"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries = STATIC_ROUTES.map((path) => ({
    url: new URL(path, siteUrl).toString(),
    lastModified: new Date(),
  }));

  const legalSlugs = (await getAllLegalPageSlugs()) ?? [];
  const legalEntries = legalSlugs.map(({ slug }) => ({
    url: new URL(`/legal/${slug}`, siteUrl).toString(),
    lastModified: new Date(),
  }));

  return [...staticEntries, ...legalEntries];
}
