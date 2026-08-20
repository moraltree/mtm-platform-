/**
 * Campaign / QR-code landing pages (e.g. `/free30`) are deliberately
 * outside the corporate site's chrome — no primary nav, no corporate
 * footer — so a visitor who scans a QR code lands on one single-purpose
 * conversion page, not the full corporate site. `CorporateChromeGate`
 * (components/patterns/CorporateChromeGate) is the one place that reads
 * this list to decide whether to render Header/Footer around a route.
 *
 * Hand-maintained by design, not derived from the filesystem — the same
 * "no generator, keep in sync by hand" convention `PAGE_ID_PATHS`
 * (lib/links.ts) and `ALWAYS_AVAILABLE` (app/sitemap.ts) already use.
 * Add a new slug here the moment a new campaign route is created (see
 * `components/patterns/CampaignLanding`'s own doc comment for the
 * intended `/blackpool`, `/pampers`, `/chester-zoo` pattern) — forgetting
 * to means that route quietly keeps the full corporate nav.
 */
export const CAMPAIGN_ROUTE_SLUGS = ["free30"] as const;

export type CampaignRouteSlug = (typeof CAMPAIGN_ROUTE_SLUGS)[number];

/** True for the campaign route itself and any of its sub-paths (e.g. a
 * future `/free30/thanks`), false for `null`/every other route. */
export function isCampaignRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return CAMPAIGN_ROUTE_SLUGS.some(
    (slug) => pathname === `/${slug}` || pathname.startsWith(`/${slug}/`),
  );
}
