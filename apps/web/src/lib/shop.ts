/**
 * Phase 1 Shopify integration (owner-approved 2026-08-21, see the
 * repo-audit report): Shopify is the system of record for merchandise —
 * catalogue, SKUs, variants, inventory, pricing, checkout, orders, and
 * fulfilment. This repo's only responsibility in this phase is a single
 * outbound link from primary nav to the Shopify-hosted storefront (see
 * `siteDefaults.ts`'s `DEFAULT_PRIMARY_NAV`). The legacy internal
 * `/shop`, `/cart`, `/checkout/*` routes and the WP7 Stripe integration
 * are left in place but unlinked from nav — dormant, not deleted, until
 * this integration is proven in production (see CLAUDE.md).
 *
 * Deliberately a plain env var, not a Sanity field or a hard-coded
 * string: swapping the store's `myshopify.com` URL for a branded domain
 * (e.g. `https://shop.moraltree.media`) later needs zero code changes,
 * just this value.
 */
export const SHOP_URL = process.env.NEXT_PUBLIC_SHOP_URL || undefined;

/**
 * True once a real Shopify storefront URL is configured. Nav omits the
 * "Shop" item entirely while this is false, rather than falling back to
 * the legacy internal `/shop` flow — the same "inert until configured,
 * honest degrade, never a broken/fake link" contract every other
 * integration in this codebase already uses (Stripe, Turnstile, Resend).
 */
export const isShopConfigured = Boolean(SHOP_URL);
