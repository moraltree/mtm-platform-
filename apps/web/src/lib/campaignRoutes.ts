/**
 * Campaign / QR-code landing pages are deliberately outside the
 * corporate site's chrome — no primary nav, no corporate footer — so a
 * visitor who scans a QR code lands on one single-purpose conversion
 * page, not the full corporate site. `CorporateChromeGate`
 * (components/patterns/CorporateChromeGate) is the one place that reads
 * this module to decide whether to render Header/Footer around a route.
 *
 * Two mechanisms, on purpose:
 *
 * 1. `CAMPAIGN_ROUTE_SLUGS` — a hand-maintained allow-list, kept for the
 *    one legacy route it already covers (`/free30`, WP8), the same
 *    "no generator, keep in sync by hand" convention `PAGE_ID_PATHS`
 *    (lib/links.ts) and `ALWAYS_AVAILABLE` (app/sitemap.ts) use.
 * 2. A route-pattern check for `/start/**` (Phase 1) — every campaign
 *    served through the generic `/start/[storyWorld]/[campaign]` route
 *    matches this automatically, with no per-campaign registration step
 *    at all. This is what makes campaign #100 as cheap as campaign #5
 *    (see the architecture proposal's routing model) — the hand-
 *    maintained list was the actual scale-blocker in the original
 *    design, not a permanent pattern to keep extending.
 *
 * Do not add new slugs to `CAMPAIGN_ROUTE_SLUGS` going forward — new
 * campaigns are Sanity documents under `/start/...`, not new entries
 * here. The list stays exactly as long as `/free30` exists outside that
 * route (see the Phase 1 report on why it hasn't been migrated yet).
 */
export const CAMPAIGN_ROUTE_SLUGS = ["free30"] as const;

export type CampaignRouteSlug = (typeof CAMPAIGN_ROUTE_SLUGS)[number];

/** True for a legacy campaign route slug, any `/start/...` route, and
 * their sub-paths (e.g. a future `/free30/thanks`); false for
 * `null`/every other route. */
export function isCampaignRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === "/start" || pathname.startsWith("/start/")) return true;
  return CAMPAIGN_ROUTE_SLUGS.some(
    (slug) => pathname === `/${slug}` || pathname.startsWith(`/${slug}/`),
  );
}
