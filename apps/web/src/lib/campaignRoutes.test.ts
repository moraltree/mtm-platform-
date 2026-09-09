import { describe, expect, it } from "vitest";
import { isCampaignRoute } from "./campaignRoutes";

/**
 * Regression coverage for the one mechanism that decides whether a
 * route gets the stripped-down campaign chrome (no corporate nav/
 * footer) or the full corporate site — see CorporateChromeGate's own
 * doc comment. There is no Sanity/mock Campaign document for Zulu/
 * Savannah Seven (see the Phase 1/2 reports — that migration is still
 * deferred), so `/free30`'s continued correctness has to be verified at
 * this routing-classification level rather than via `getCampaignForRoute`.
 */
describe("isCampaignRoute", () => {
  it("still classifies /free30 (Savannah Seven) as a campaign route", () => {
    expect(isCampaignRoute("/free30")).toBe(true);
    expect(isCampaignRoute("/free30/thanks")).toBe(true);
  });

  it("classifies every /start/... campaign as a campaign route, with no per-campaign registration", () => {
    expect(
      isCampaignRoute("/start/river-rangers/river-rangers-water-safety"),
    ).toBe(true);
    expect(isCampaignRoute("/start/understory/meadow-cove-launch")).toBe(true);
    expect(
      isCampaignRoute("/start/any-future-story-world/any-future-campaign"),
    ).toBe(true);
  });

  it("does not classify corporate/shop routes as campaign routes", () => {
    expect(isCampaignRoute("/")).toBe(false);
    expect(isCampaignRoute("/about")).toBe(false);
    expect(isCampaignRoute("/shop")).toBe(false);
    expect(isCampaignRoute("/story-worlds/understory")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isCampaignRoute(null)).toBe(false);
  });
});
