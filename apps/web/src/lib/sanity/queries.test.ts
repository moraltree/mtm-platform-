import { describe, expect, it } from "vitest";
import {
  campaignBelongsToPartner,
  getCampaignByShortCode,
  getCampaignForRoute,
  getCampaignIdentifiers,
  getDomainMapping,
  getPartnerByKey,
  getStoryWorldByKey,
  isStoryWorldPermitted,
} from "./queries";
import {
  internationalWaterCompanyPartner,
  riverRangersStoryWorld,
  riverRangersWaterSafetyCampaign,
} from "../devRecords";
import type { CampaignDoc, StoryWorldDoc } from "./types";

/**
 * A committed replacement for Phase 2's one-off verification script
 * (see the Phase 2 report) — runs under `USE_MOCK_CONTENT=true`
 * (vitest.config.ts), the exact same mock-fallback path production
 * traffic hits today (no real Sanity project exists — see CLAUDE.md),
 * so these tests exercise real production code paths, not a third,
 * test-only implementation.
 */

// A Story World International Water Company never permitted — reused
// across several "should be rejected" cases below.
const unpermittedStoryWorld: StoryWorldDoc = {
  _id: "test-sw-unpermitted",
  title: "Test Unpermitted Story World",
  slug: { current: "test-unpermitted" },
  key: "test-unpermitted",
  heroImage: riverRangersStoryWorld.heroImage,
};

describe("isStoryWorldPermitted", () => {
  it("allows a permitted partner + permitted Story World (the real River Rangers × International Water Company fixture)", () => {
    expect(isStoryWorldPermitted(riverRangersWaterSafetyCampaign)).toBe(true);
  });

  it("rejects a permitted partner with a non-permitted Story World", () => {
    const decoy: CampaignDoc = {
      ...riverRangersWaterSafetyCampaign,
      storyWorld: unpermittedStoryWorld,
    };
    expect(isStoryWorldPermitted(decoy)).toBe(false);
  });

  it("defaults open when the partner configures no restriction at all", () => {
    const unrestrictedPartner = {
      ...internationalWaterCompanyPartner,
      permittedStoryWorlds: [],
    };
    const campaign: CampaignDoc = {
      ...riverRangersWaterSafetyCampaign,
      partner: unrestrictedPartner,
      storyWorld: unpermittedStoryWorld,
    };
    expect(isStoryWorldPermitted(campaign)).toBe(true);
  });

  it("allows a campaign with no partner at all (Moral-Tree-direct, e.g. the shape /free30 would eventually take)", () => {
    const directCampaign: CampaignDoc = {
      ...riverRangersWaterSafetyCampaign,
      partner: undefined,
    };
    expect(isStoryWorldPermitted(directCampaign)).toBe(true);
  });
});

describe("campaignBelongsToPartner", () => {
  it("confirms a campaign belongs to its own partner", () => {
    expect(
      campaignBelongsToPartner(
        riverRangersWaterSafetyCampaign,
        "international-water-company",
      ),
    ).toBe(true);
  });

  it("rejects a campaign checked against a different tenant's key", () => {
    expect(
      campaignBelongsToPartner(
        riverRangersWaterSafetyCampaign,
        "meadow-cove-nature-trust",
      ),
    ).toBe(false);
  });
});

describe("getCampaignForRoute", () => {
  it("resolves the River Rangers × International Water Company development fixture", async () => {
    const result = await getCampaignForRoute(
      "river-rangers",
      "river-rangers-water-safety",
    );
    expect(result?.key).toBe("rr-watersafety-iwc-dev01");
  });

  it("resolves the Phase 1 Understory × Meadow Cove fixture (regression check)", async () => {
    const result = await getCampaignForRoute(
      "understory",
      "meadow-cove-launch",
    );
    expect(result?.key).toBe("meadow-cove-launch");
  });

  it("rejects a real campaign slug requested under the wrong Story World segment", async () => {
    // "river-rangers-water-safety" is real, but scoped to "river-rangers" —
    // asking for it under "understory" must not resolve (campaign
    // belonging to another Story World).
    const result = await getCampaignForRoute(
      "understory",
      "river-rangers-water-safety",
    );
    expect(result).toBeNull();
  });

  it("rejects an unknown campaign slug", async () => {
    const result = await getCampaignForRoute(
      "river-rangers",
      "no-such-campaign",
    );
    expect(result).toBeNull();
  });

  it("rejects an unknown Story World slug", async () => {
    const result = await getCampaignForRoute(
      "no-such-story-world",
      "river-rangers-water-safety",
    );
    expect(result).toBeNull();
  });
});

describe("getCampaignIdentifiers", () => {
  it("resolves the same stable keys getCampaignForRoute would, for the River Rangers fixture", async () => {
    const result = await getCampaignIdentifiers(
      "river-rangers",
      "river-rangers-water-safety",
    );
    expect(result).toEqual({
      key: "rr-watersafety-iwc-dev01",
      partnerKey: "international-water-company",
      storyWorldKey: "river-rangers",
    });
  });

  it("rejects an unknown campaign", async () => {
    expect(await getCampaignIdentifiers("river-rangers", "nope")).toBeNull();
  });
});

describe("getPartnerByKey / getStoryWorldByKey", () => {
  it("resolves International Water Company by its stable key", async () => {
    const result = await getPartnerByKey("international-water-company");
    expect(result?.name).toBe("International Water Company");
  });

  it("rejects an unknown partner key", async () => {
    expect(await getPartnerByKey("no-such-partner")).toBeNull();
  });

  it("resolves River Rangers by its stable key", async () => {
    const result = await getStoryWorldByKey("river-rangers");
    expect(result?.title).toBe("River Rangers");
  });

  it("rejects an unknown Story World key", async () => {
    expect(await getStoryWorldByKey("no-such-story-world")).toBeNull();
  });
});

describe("getCampaignByShortCode", () => {
  it("resolves the River Rangers water-safety poster short code as active", async () => {
    const result = await getCampaignByShortCode("rr-watersafety-poster");
    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("unreachable");
    expect(result.campaign.key).toBe("rr-watersafety-iwc-dev01");
    expect(result.source.code).toBe("water-safety-poster");
  });

  it("resolves the Phase 1 Meadow Cove gift-shop short code as active", async () => {
    const result = await getCampaignByShortCode("mc-giftshop");
    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("unreachable");
    expect(result.campaign.key).toBe("meadow-cove-launch");
  });

  it("fails safely with not-found for an unknown short code", async () => {
    expect(await getCampaignByShortCode("no-such-code")).toEqual({
      status: "not-found",
    });
  });

  it("resolves a paused campaign's short code as inactive, not active", async () => {
    const result = await getCampaignByShortCode("test-paused-poster");
    expect(result.status).toBe("inactive");
    if (result.status !== "inactive") throw new Error("unreachable");
    expect(result.reason).toBe("paused");
  });

  it("carries a per-campaign unavailableMessage override through for /campaign-unavailable to use", async () => {
    const result = await getCampaignByShortCode("test-paused-poster");
    expect(result.status).toBe("inactive");
    if (result.status !== "inactive") throw new Error("unreachable");
    expect(result.campaign.unavailableMessage).toContain(
      "proves the per-campaign override path",
    );
  });

  it("resolves an expired campaign's short code as inactive, computed from its past end date alone", async () => {
    const result = await getCampaignByShortCode("test-expired-poster");
    expect(result.status).toBe("inactive");
    if (result.status !== "inactive") throw new Error("unreachable");
    expect(result.reason).toBe("expired");
  });

  it("resolves a scheduled (future-dated) campaign's short code as inactive, not active", async () => {
    const result = await getCampaignByShortCode("test-scheduled-poster");
    expect(result.status).toBe("inactive");
    if (result.status !== "inactive") throw new Error("unreachable");
    expect(result.reason).toBe("scheduled");
  });

  it("resolves an archived campaign's short code as inactive, distinct from paused", async () => {
    const result = await getCampaignByShortCode("test-archived-poster");
    expect(result.status).toBe("inactive");
    if (result.status !== "inactive") throw new Error("unreachable");
    expect(result.reason).toBe("archived");
  });

  it("resolves an individually deactivated acquisition source as inactive with its own reason, even though the campaign itself is active", async () => {
    const result = await getCampaignByShortCode("test-disabled-source-poster");
    expect(result.status).toBe("inactive");
    if (result.status !== "inactive") throw new Error("unreachable");
    expect(result.reason).toBe("source-disabled");
  });

  it("rejects a short-code collision rather than picking a winner", async () => {
    expect(await getCampaignByShortCode("test-collision")).toEqual({
      status: "collision",
    });
  });
});

describe("getDomainMapping", () => {
  it("resolves International Water Company's test domain to its stable partner key", async () => {
    const result = await getDomainMapping("stories.internationalwater.test");
    expect(result).toEqual({ partnerKey: "international-water-company" });
  });

  it("fails safely (null) for an unknown domain", async () => {
    expect(await getDomainMapping("no-such-domain.test")).toBeNull();
  });
});

describe("malformed/edge-case route input", () => {
  it("does not throw for empty-string segments", async () => {
    await expect(getCampaignForRoute("", "")).resolves.toBeNull();
  });

  it("does not throw for unexpected characters in route segments", async () => {
    await expect(
      getCampaignForRoute("../../etc/passwd", "'; DROP TABLE campaigns; --"),
    ).resolves.toBeNull();
  });

  it("does not throw for an empty short code", async () => {
    await expect(getCampaignByShortCode("")).resolves.toEqual({
      status: "not-found",
    });
  });
});
