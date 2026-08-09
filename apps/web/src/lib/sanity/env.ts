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
