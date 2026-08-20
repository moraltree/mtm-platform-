import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCampaignIdentifiers } from "./lib/sanity/queries";
import {
  buildAttributionPayload,
  resolveAttributionState,
} from "./lib/attribution/capture";
import {
  FIRST_TOUCH_COOKIE_NAME,
  parseAttributionCookie,
  serializeFirstTouchCookie,
  serializeLatestTouchCookie,
} from "./lib/attribution/cookie";
import { asCampaignId, asPartnerId, asStoryWorldId } from "./lib/platform/ids";

/**
 * Writes the two attribution cookies (see lib/attribution) on every
 * `/start/[storyWorld]/[campaign]` landing. This has to happen here,
 * not in the route's own Server Component: Next.js only allows
 * `cookies().set()` from a Server Action or Route Handler, and a plain
 * page render can only read cookies, not write them. Proxy defaults to
 * the Node.js runtime in this Next.js version (see this file's own
 * `node:crypto` dependency by way of lib/attribution/cookie.ts), so
 * there's no Edge-runtime incompatibility to work around.
 *
 * Deliberately scoped to attribution only in this phase — custom-domain
 * host-header resolution (architecture proposal §13) is a separate,
 * later concern this file does not yet implement; the matcher below
 * only covers the one route pattern Phase 1 introduces.
 *
 * Queries Sanity/mock content a second time here (a small, dedicated
 * projection — see `getCampaignIdentifiers`'s own doc comment) purely to
 * resolve the campaign/partner/story-world's stable `key` values before
 * writing them into the cookie; the page's own, much larger content
 * query is separate and unaffected.
 */
export function proxy(request: NextRequest) {
  const match = /^\/start\/([^/]+)\/([^/]+)/.exec(request.nextUrl.pathname);
  if (!match) return NextResponse.next();
  const [, storyWorldSlug, campaignSlug] = match;

  return handleCampaignLanding(request, storyWorldSlug, campaignSlug);
}

async function handleCampaignLanding(
  request: NextRequest,
  storyWorldSlug: string,
  campaignSlug: string,
) {
  const identifiers = await getCampaignIdentifiers(
    storyWorldSlug,
    campaignSlug,
  );
  // No matching campaign — let the request through unchanged. The page's
  // own lookup 404s honestly; Proxy doesn't need to duplicate that.
  if (!identifiers) return NextResponse.next();

  const fresh = buildAttributionPayload({
    campaignId: asCampaignId(identifiers.key),
    partnerId: identifiers.partnerKey
      ? asPartnerId(identifiers.partnerKey)
      : undefined,
    storyWorldId: identifiers.storyWorldKey
      ? asStoryWorldId(identifiers.storyWorldKey)
      : undefined,
    searchParams: Object.fromEntries(request.nextUrl.searchParams.entries()),
    landingPath: request.nextUrl.pathname,
  });

  const existingFirst = parseAttributionCookie(
    request.cookies.get(FIRST_TOUCH_COOKIE_NAME)?.value,
  );
  const { first, latest, firstIsNew } = resolveAttributionState(
    existingFirst,
    fresh,
  );

  const response = NextResponse.next();

  // First-touch is sticky — only written the first time it doesn't
  // already exist. Never re-written after that, per the owner's
  // decision that first-touch must never be overwritten by later visits.
  if (firstIsNew) {
    const cookie = serializeFirstTouchCookie(first);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }

  // Latest-touch is unconditional — every campaign landing refreshes it.
  const latestCookie = serializeLatestTouchCookie(latest);
  response.cookies.set(
    latestCookie.name,
    latestCookie.value,
    latestCookie.options,
  );

  return response;
}

export const config = {
  matcher: ["/start/:storyWorld/:campaign"],
};
