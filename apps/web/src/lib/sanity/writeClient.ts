import { createClient } from "@sanity/client";
import {
  apiVersion,
  dataset,
  isSanityWriteConfigured,
  projectId,
  sanityWriteToken,
} from "./env";

/**
 * Authenticated, write-capable Sanity client — `null` unless both a real
 * project and `SANITY_API_WRITE_TOKEN` are configured (see env.ts).
 * Deliberately separate from `client.ts`'s read-only `sanityClient`: every
 * other Sanity access in this codebase is read-only by design (see
 * client.ts's own doc comment), and this is the one exception — the
 * Stripe webhook (`app/api/stripe/webhook/route.ts`) writing `order`
 * documents. Don't reach for this from anywhere else without a similarly
 * good reason.
 */
export const sanityWriteClient = isSanityWriteConfigured
  ? createClient({
      projectId,
      dataset,
      apiVersion,
      useCdn: false, // writes must never go through the CDN
      token: sanityWriteToken,
    })
  : null;
