import type { MetadataRoute } from "next";
import { useMockContent } from "@/lib/sanity/env";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  // Extra safety net alongside layout.tsx's per-page noindex: if
  // USE_MOCK_CONTENT is ever left on somewhere it shouldn't be, nothing
  // gets crawled at all.
  if (useMockContent) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/style-guide"],
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
