import { describe, expect, it } from "vitest";
import {
  getUnavailableCopy,
  isUnavailableReason,
} from "./campaignUnavailableCopy";

describe("isUnavailableReason", () => {
  it.each([
    "draft",
    "scheduled",
    "paused",
    "expired",
    "archived",
    "source-disabled",
  ])("recognises %s as a valid reason", (reason) => {
    expect(isUnavailableReason(reason)).toBe(true);
  });

  it("rejects unknown strings", () => {
    expect(isUnavailableReason("something-else")).toBe(false);
  });

  it("rejects non-strings without throwing", () => {
    expect(isUnavailableReason(undefined)).toBe(false);
    expect(isUnavailableReason(null)).toBe(false);
    expect(isUnavailableReason(42)).toBe(false);
  });
});

describe("getUnavailableCopy", () => {
  it("returns distinct, non-empty copy for every known reason", () => {
    const reasons = [
      "draft",
      "scheduled",
      "paused",
      "expired",
      "archived",
      "source-disabled",
    ] as const;
    const seen = new Set<string>();
    for (const reason of reasons) {
      const copy = getUnavailableCopy(reason);
      expect(copy.heading.length).toBeGreaterThan(0);
      expect(copy.body.length).toBeGreaterThan(0);
      seen.add(copy.heading);
    }
    // Each reason reads as its own message, not a shared generic one.
    expect(seen.size).toBe(reasons.length);
  });

  it("falls back to generic copy for an unrecognised or missing reason", () => {
    expect(getUnavailableCopy(undefined)).toEqual(getUnavailableCopy("bogus"));
  });

  it("never mentions a partner, Story World, or campaign name in the default copy", () => {
    const allCopy = [
      "draft",
      "scheduled",
      "paused",
      "expired",
      "archived",
      "source-disabled",
      undefined,
    ].map((r) => getUnavailableCopy(r));
    for (const { heading, body } of allCopy) {
      expect(`${heading} ${body}`).not.toMatch(
        /river rangers|international water|moral tree|zulu/i,
      );
    }
  });
});
