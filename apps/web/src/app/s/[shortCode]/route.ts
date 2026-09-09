import { NextResponse, type NextRequest } from "next/server";
import { getCampaignByShortCode } from "@/lib/sanity/queries";

/**
 * The QR/campaign short-link redirector (architecture proposal §8) —
 * `/s/[shortCode]` resolves through campaign configuration to the
 * canonical `/start/[storyWorld]/[campaign]` destination, so a QR code
 * printed on a poster/bookmark keeps working even if the campaign it
 * points at is later renamed, re-themed, paused, or (via `status`/
 * dates) expires — nothing about the printed code itself has to change.
 *
 * No campaign-specific code here or anywhere else:
 * `getCampaignByShortCode` (lib/sanity/queries.ts) is the one, generic
 * lookup every short code goes through, keyed on the *campaign's*
 * stable identity (its `key`, resolved via matching an
 * `acquisitionSources[].shortCode` entry) rather than on a slug or a
 * hand-maintained route table.
 *
 * Three distinct outcomes, not just found/not-found (see
 * `ShortCodeResolution`'s own doc comment for the full reasoning):
 *
 * - **`active`**: normal 307 redirect to the campaign, with attribution
 *   preserved (see below).
 * - **`inactive`**: a real, permitted campaign that isn't currently
 *   live (draft/scheduled/paused/expired/archived, or this specific
 *   placement was individually deactivated). The code itself is not
 *   broken — redirect to `/campaign-unavailable` (Phase 5) rather than a
 *   dead-end 404 or the bare homepage, carrying only a generic `reason`
 *   category and the short code itself (already known to the visitor —
 *   see that page's own doc comment on why neither of those leaks
 *   partner/Story-World/campaign identity).
 * - **`not-found` / `collision`**: genuinely unknown code, or a data-
 *   integrity failure (two acquisition sources sharing one short code)
 *   the route must not guess through — both fail the same honest way,
 *   a plain 404, which is what keeps "this code never existed"
 *   distinguishable from "this code is real but not running right now".
 *
 * A `307 Temporary Redirect`, not `308 Permanent` — deliberately.
 * Browsers/CDNs are allowed to cache a `308` indefinitely, which would
 * defeat "campaign deactivation without changing printed QR codes": if
 * a client cached the old destination permanently, re-pointing,
 * pausing, or expiring a campaign later wouldn't reach anyone with a
 * cached redirect. Every request re-resolves the short code fresh.
 *
 * Custom-domain support (architecture proposal §13) is a separate,
 * later concern — this route only ever redirects to a path on the same
 * origin it was requested on (`request.url`'s own origin), so it keeps
 * working unmodified once a partner subdomain resolves here too.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> },
) {
  const { shortCode } = await params;
  const resolution = await getCampaignByShortCode(shortCode);

  if (resolution.status === "not-found" || resolution.status === "collision") {
    return new NextResponse("Short link not found.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  if (resolution.status === "inactive") {
    // The code is real; the campaign (or this specific placement) just
    // isn't running right now. `reason` is a generic lifecycle category
    // only — never a partner/Story-World/campaign identifier — and
    // `code` is the short code the visitor already possesses. See
    // /campaign-unavailable/page.tsx's doc comment for exactly what
    // this page does and doesn't look up from those two values.
    const unavailable = new URL("/campaign-unavailable", request.url);
    unavailable.searchParams.set("reason", resolution.reason);
    unavailable.searchParams.set("code", shortCode);
    return NextResponse.redirect(unavailable, 307);
  }

  const { campaign, source } = resolution;
  if (!campaign.storyWorld) {
    // Shouldn't happen for a campaign the route above already validated
    // (getCampaignForRoute requires a Story World to resolve at all),
    // but fail the same safe way as any other unresolvable case rather
    // than throwing.
    return new NextResponse("Short link not found.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const destination = new URL(
    `/start/${campaign.storyWorld.slug.current}/${campaign.slug.current}`,
    request.url,
  );

  // Anything already on the short-link URL (a marketer's own added
  // detail, e.g. ?utm_content=variant-2) passes through untouched.
  request.nextUrl.searchParams.forEach((value, key) => {
    destination.searchParams.set(key, value);
  });

  // The acquisition source's own UTM defaults fill in whatever the
  // incoming request didn't already specify — never override an
  // explicit value someone put on the printed/shared URL itself.
  const defaults = source.utmDefaults;
  const fillDefault = (param: string, value: string | undefined) => {
    if (value && !destination.searchParams.has(param)) {
      destination.searchParams.set(param, value);
    }
  };
  fillDefault("utm_source", defaults?.source);
  fillDefault("utm_medium", defaults?.medium);
  fillDefault("utm_campaign", defaults?.campaign);
  fillDefault("utm_content", defaults?.content);

  // `src` always reflects *this* short code's own registered acquisition
  // source — forced, not merely defaulted, since resolving that
  // unambiguously is this route's entire job. A visitor scanning a
  // physical QR code never supplies `src` themselves; anyone who tried
  // to override it on a hand-typed link shouldn't be able to.
  destination.searchParams.set("src", source.code);

  return NextResponse.redirect(destination, 307);
}
