import type { MetadataRoute } from "next";
import { PAGE_ID_PATHS } from "@/lib/links";
import type { PageId } from "@/lib/sanity/types";
import { useMockContent } from "@/lib/sanity/env";
import {
  getAllLegalPageSlugs,
  getExistingPageIds,
  getNewsPosts,
  getProducts,
  getStoryWorlds,
} from "@/lib/sanity/queries";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// These routes always resolve regardless of CMS state (see
// lib/editorialPage.tsx / individual page.tsx files for why) — every other
// pageId is only included once a real `page` document exists for it, so
// the sitemap never points search engines at a 404.
const ALWAYS_AVAILABLE: PageId[] = [
  "home",
  "leadership",
  "contact",
  "news",
  "story-worlds",
  "shop",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // robots.ts already disallows all crawling in this mode; an empty
  // sitemap alongside it means nothing about preview/mock URLs is ever
  // published for search engines to find.
  if (useMockContent) return [];

  const existingPageIds = new Set((await getExistingPageIds()) ?? []);

  const pageEntries = (Object.entries(PAGE_ID_PATHS) as Array<[PageId, string]>)
    .filter(([id]) => ALWAYS_AVAILABLE.includes(id) || existingPageIds.has(id))
    .map(([, path]) => ({
      url: new URL(path, siteUrl).toString(),
      lastModified: new Date(),
    }));

  const legalSlugs = (await getAllLegalPageSlugs()) ?? [];
  const legalEntries = legalSlugs.map(({ slug }) => ({
    url: new URL(`/legal/${slug}`, siteUrl).toString(),
    lastModified: new Date(),
  }));

  const newsPosts = (await getNewsPosts(1000)) ?? [];
  const newsEntries = newsPosts.map((post) => ({
    url: new URL(`/news/${post.slug.current}`, siteUrl).toString(),
    lastModified: new Date(post.publishedAt),
  }));

  const storyWorlds = (await getStoryWorlds()) ?? [];
  const storyWorldEntries = storyWorlds.map((storyWorld) => ({
    url: new URL(
      `/story-worlds/${storyWorld.slug.current}`,
      siteUrl,
    ).toString(),
    lastModified: new Date(),
  }));

  const products = (await getProducts()) ?? [];
  const productEntries = products.map((product) => ({
    url: new URL(`/shop/${product.slug.current}`, siteUrl).toString(),
    lastModified: new Date(),
  }));

  return [
    ...pageEntries,
    ...legalEntries,
    ...newsEntries,
    ...storyWorldEntries,
    ...productEntries,
  ];
}
