import { createClient, type ClientPerspective } from "@sanity/client";
import { apiVersion, dataset, isSanityConfigured, projectId } from "./env";

/**
 * `null` until a real Sanity project is configured (see env.ts) — every
 * caller must handle that, not just assume a client exists. Read-only:
 * mutations go through a separate authenticated client if/when WP4's
 * forms or draft-mode tooling need one.
 */
export const sanityClient = isSanityConfigured
  ? createClient({
      projectId,
      dataset,
      apiVersion,
      useCdn: process.env.NODE_ENV === "production",
      perspective: "published" as ClientPerspective,
    })
  : null;

/**
 * Fetch helper that degrades to `null` instead of throwing when Sanity
 * isn't configured yet, so pages can fall back to placeholder content
 * during WP2–WP4. Once content is expected to exist unconditionally
 * (post-WP5), callers should treat a `null` result as a real error again.
 */
export async function sanityFetch<T>(
  query: string,
  params: Record<string, unknown> = {},
): Promise<T | null> {
  if (!sanityClient) return null;
  return sanityClient.fetch<T>(query, params);
}
