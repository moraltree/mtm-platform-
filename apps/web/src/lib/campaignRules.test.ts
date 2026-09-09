import { describe, expect, it } from "vitest";
import {
  isCampaignEffectivelyActive,
  resolveCampaignLifecycleStatus,
} from "./campaignRules";

const NOW = new Date("2026-06-15T12:00:00.000Z");
const PAST = "2026-01-01T00:00:00.000Z";
const FUTURE = "2026-12-01T00:00:00.000Z";

describe("resolveCampaignLifecycleStatus", () => {
  it("draft stays draft regardless of dates", () => {
    expect(
      resolveCampaignLifecycleStatus(
        { status: "draft", startDate: PAST, endDate: FUTURE },
        NOW,
      ),
    ).toBe("draft");
  });

  it("archived stays archived regardless of dates (admin override wins)", () => {
    expect(
      resolveCampaignLifecycleStatus(
        { status: "archived", startDate: PAST, endDate: FUTURE },
        NOW,
      ),
    ).toBe("archived");
  });

  it("paused stays paused even mid-way through a live date window", () => {
    expect(
      resolveCampaignLifecycleStatus(
        { status: "paused", startDate: PAST, endDate: FUTURE },
        NOW,
      ),
    ).toBe("paused");
  });

  it("active with no dates at all is simply active (no-expiry campaign)", () => {
    expect(resolveCampaignLifecycleStatus({ status: "active" }, NOW)).toBe(
      "active",
    );
  });

  it("active becomes scheduled before its start date", () => {
    expect(
      resolveCampaignLifecycleStatus(
        { status: "active", startDate: FUTURE },
        NOW,
      ),
    ).toBe("scheduled");
  });

  it("scheduled becomes active once its start date has passed", () => {
    expect(
      resolveCampaignLifecycleStatus(
        { status: "scheduled", startDate: PAST },
        NOW,
      ),
    ).toBe("active");
  });

  it("active becomes expired after its end date, with no admin edit needed", () => {
    expect(
      resolveCampaignLifecycleStatus(
        { status: "active", startDate: PAST, endDate: PAST },
        NOW,
      ),
    ).toBe("expired");
  });

  it("active within its start/end window is active", () => {
    expect(
      resolveCampaignLifecycleStatus(
        { status: "active", startDate: PAST, endDate: FUTURE },
        NOW,
      ),
    ).toBe("active");
  });

  it("degrades safely (does not throw) for a malformed date string, treating it as absent", () => {
    expect(() =>
      resolveCampaignLifecycleStatus(
        { status: "active", startDate: "not-a-real-date" },
        NOW,
      ),
    ).not.toThrow();
    expect(
      resolveCampaignLifecycleStatus(
        { status: "active", startDate: "not-a-real-date" },
        NOW,
      ),
    ).toBe("active");
  });

  it("defaults `now` to the current instant when omitted", () => {
    // Far-future start date relative to whenever this test actually
    // runs — proves the default parameter is live, not hard-coded.
    expect(
      resolveCampaignLifecycleStatus({
        status: "active",
        startDate: "2999-01-01T00:00:00.000Z",
      }),
    ).toBe("scheduled");
  });
});

describe("isCampaignEffectivelyActive", () => {
  it("is true only for the computed active state", () => {
    expect(
      isCampaignEffectivelyActive(
        { status: "active", startDate: PAST, endDate: FUTURE },
        NOW,
      ),
    ).toBe(true);
  });

  it.each(["draft" as const, "paused" as const, "archived" as const])(
    "is false for stored status %s",
    (status) => {
      expect(isCampaignEffectivelyActive({ status }, NOW)).toBe(false);
    },
  );

  it("is false once expired", () => {
    expect(
      isCampaignEffectivelyActive({ status: "active", endDate: PAST }, NOW),
    ).toBe(false);
  });

  it("is false before a scheduled start", () => {
    expect(
      isCampaignEffectivelyActive({ status: "active", startDate: FUTURE }, NOW),
    ).toBe(false);
  });
});
