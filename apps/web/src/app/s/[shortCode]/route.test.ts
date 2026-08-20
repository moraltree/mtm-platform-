import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET } from "./route";

/**
 * Route-level coverage for the short-link redirector — not just
 * `getCampaignByShortCode`'s data shape (see `lib/sanity/queries.test
 * .ts`), but the actual HTTP behaviour Phase 5's brief asks for:
 * active → the campaign; paused/scheduled/expired/archived/source-
 * disabled → `/campaign-unavailable`; unknown/collision → 404 — and
 * that the unavailable redirect never leaks tenant/campaign identity
 * beyond the generic `reason` category and the already-public short
 * code itself.
 */

function request(shortCode: string, search = ""): NextRequest {
  return new NextRequest(
    new URL(`https://moraltree.media/s/${shortCode}${search}`),
  );
}

async function callRoute(shortCode: string, search = "") {
  return GET(request(shortCode, search), {
    params: Promise.resolve({ shortCode }),
  });
}

describe("/s/[shortCode] — active campaigns", () => {
  it("redirects an active campaign's short code to its canonical destination", async () => {
    const response = await callRoute("rr-watersafety-poster");
    expect(response.status).toBe(307);
    const location = response.headers.get("location")!;
    expect(location).toContain(
      "/start/river-rangers/river-rangers-water-safety",
    );
    expect(location).toContain("src=water-safety-poster");
  });
});

describe("/s/[shortCode] — unavailable campaigns redirect to /campaign-unavailable", () => {
  const cases: Array<[shortCode: string, reason: string]> = [
    ["test-paused-poster", "paused"],
    ["test-expired-poster", "expired"],
    ["test-scheduled-poster", "scheduled"],
    ["test-archived-poster", "archived"],
    ["test-disabled-source-poster", "source-disabled"],
  ];

  it.each(cases)(
    "%s → /campaign-unavailable?reason=%s",
    async (shortCode, reason) => {
      const response = await callRoute(shortCode);
      expect(response.status).toBe(307);
      const location = new URL(response.headers.get("location")!);
      expect(location.pathname).toBe("/campaign-unavailable");
      expect(location.searchParams.get("reason")).toBe(reason);
      expect(location.searchParams.get("code")).toBe(shortCode);
    },
  );

  it("never includes a partner/Story-World/campaign identifier or title in the unavailable redirect", async () => {
    for (const [shortCode] of cases) {
      const response = await callRoute(shortCode);
      const location = response.headers.get("location")!;
      expect(location).not.toMatch(
        /river-rangers-water-safety|international-water-company|rr-watersafety-iwc-dev01|Water Safety/i,
      );
    }
  });
});

describe("/s/[shortCode] — genuinely unknown or colliding codes stay a plain 404", () => {
  it("404s for an unknown short code, distinctly from the unavailable redirect", async () => {
    const response = await callRoute("no-such-code-at-all");
    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
  });

  it("404s for a short-code collision rather than redirecting anywhere", async () => {
    const response = await callRoute("test-collision");
    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("/s/[shortCode] — attribution/query preservation on the active path", () => {
  it("preserves an incoming utm_content param and still forces the correct src", async () => {
    const response = await callRoute(
      "mc-giftshop",
      "?utm_content=hand-added&src=someone-tried-to-override",
    );
    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("utm_content")).toBe("hand-added");
    expect(location.searchParams.get("src")).toBe("meadow-cove-giftshop");
  });
});
