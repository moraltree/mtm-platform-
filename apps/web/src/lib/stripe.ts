import Stripe from "stripe";
import { useMockContent } from "./sanity/env";
import { mockProductPrices } from "./mockContent";
import type { ResolvedPrice } from "./sanity/types";

export { formatPrice } from "./format";

const secretKey = process.env.STRIPE_SECRET_KEY;

export const isStripeConfigured = Boolean(secretKey);

// Pinned to the exact version this SDK build (stripe@22.5.0) itself
// defaults to (see node_modules/stripe/cjs/apiVersion.d.ts) — explicit
// rather than relying on the SDK's own default, so an SDK upgrade can't
// silently change checkout/webhook behaviour without this being touched
// (and re-verified) too.
const STRIPE_API_VERSION = "2026-07-29.dahlia";

/**
 * `null` until `STRIPE_SECRET_KEY` is set (see .env.example) — every
 * caller must handle that, the same contract as `sanityClient`
 * (lib/sanity/client.ts). Nothing in this codebase creates a Stripe
 * client anywhere else.
 */
export const stripe = secretKey
  ? new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION })
  : null;

/**
 * Live price lookup — the product catalogue's display price always comes
 * from here, never from a value duplicated in Sanity (see
 * apps/studio/schemaTypes/documents/product.ts's doc comment on why).
 * Returns `null` if Stripe isn't configured or the price ID doesn't
 * resolve, so callers can omit pricing rather than show something wrong.
 *
 * Falls back to `mockContent.ts`'s `mockProductPrices` when Stripe isn't
 * configured and mock content is on, the same "degrade to stub data"
 * contract `queries.ts` uses for Sanity — mock products use fake
 * ("price_mock_...") IDs that could never resolve against a real Stripe
 * account anyway.
 */
export async function getProductPrice(
  stripePriceId: string,
): Promise<ResolvedPrice | null> {
  if (!stripe) {
    return useMockContent ? (mockProductPrices[stripePriceId] ?? null) : null;
  }
  if (!stripePriceId) return null;
  try {
    const price = await stripe.prices.retrieve(stripePriceId);
    if (price.unit_amount == null) return null;
    return {
      unitAmount: price.unit_amount,
      currency: price.currency,
      // Stripe's SDK type includes a forward-compat `OtherString` escape
      // hatch alongside the 4 known intervals; real Prices only ever use
      // one of the 4, so this narrows safely in practice.
      recurringInterval: price.recurring
        ?.interval as ResolvedPrice["recurringInterval"],
    };
  } catch (error) {
    console.error(`Failed to retrieve Stripe price ${stripePriceId}:`, error);
    return null;
  }
}
