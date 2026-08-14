/**
 * No real Sanity project exists yet (WP2 scaffolding stage) — every
 * consumer of this module must tolerate `projectId`/`dataset` being
 * undefined so the site keeps building without live credentials. Once a
 * real project exists, set these in apps/web/.env.local (see
 * .env.example) and `isSanityConfigured` flips on automatically.
 */
export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
export const apiVersion = "2025-01-01";

export const isSanityConfigured = Boolean(projectId);

/**
 * Write access — separate from (and stricter than) `isSanityConfigured`.
 * Only the Stripe webhook's order-recording needs this; everything else
 * in this codebase is deliberately read-only. See sanity/writeClient.ts.
 */
export const sanityWriteToken = process.env.SANITY_API_WRITE_TOKEN;
export const isSanityWriteConfigured =
  isSanityConfigured && Boolean(sanityWriteToken);

/**
 * Opt-in local preview aid — never on by default, never in CI/production
 * unless someone deliberately sets it. When true and Sanity is
 * unconfigured, queries.ts substitutes lib/mockContent.ts's stub data so
 * every route renders for visual review instead of its honest null-state
 * (404/empty/fallback). Does not touch the null-handling contract itself:
 * with this unset, behavior is identical to before it existed.
 */
export const useMockContent = process.env.USE_MOCK_CONTENT === "true";
