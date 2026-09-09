/**
 * Trial configuration tests.
 *
 * Covers:
 * - clampTrialDays: boundary values, negative, non-finite, over max
 * - resolveTrialDaysFromConfig: default, campaign override, source override,
 *   30-day max enforcement, unknown campaign/source fallback, env var parsing
 * - Browser cannot choose arbitrary duration (structural — function is
 *   server-side only and takes no duration argument from outside)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  clampTrialDays,
  resolveTrialDaysFromConfig,
  MAX_TRIAL_DAYS,
} from "./trialConfig";

const saved = { ...process.env };

afterEach(() => {
  process.env.DEFAULT_TRIAL_DAYS = saved.DEFAULT_TRIAL_DAYS;
  process.env.STRIPE_TRIAL_PERIOD_DAYS = saved.STRIPE_TRIAL_PERIOD_DAYS;
  process.env.TRIAL_DAYS_BY_CAMPAIGN = saved.TRIAL_DAYS_BY_CAMPAIGN;
  process.env.TRIAL_DAYS_BY_SOURCE = saved.TRIAL_DAYS_BY_SOURCE;
  if (!("DEFAULT_TRIAL_DAYS" in saved)) delete process.env.DEFAULT_TRIAL_DAYS;
  if (!("STRIPE_TRIAL_PERIOD_DAYS" in saved))
    delete process.env.STRIPE_TRIAL_PERIOD_DAYS;
  if (!("TRIAL_DAYS_BY_CAMPAIGN" in saved))
    delete process.env.TRIAL_DAYS_BY_CAMPAIGN;
  if (!("TRIAL_DAYS_BY_SOURCE" in saved)) delete process.env.TRIAL_DAYS_BY_SOURCE;
});

describe("MAX_TRIAL_DAYS", () => {
  it("is 30", () => {
    expect(MAX_TRIAL_DAYS).toBe(30);
  });
});

describe("clampTrialDays", () => {
  it("passes through values in the valid range", () => {
    expect(clampTrialDays(0)).toBe(0);
    expect(clampTrialDays(7)).toBe(7);
    expect(clampTrialDays(14)).toBe(14);
    expect(clampTrialDays(21)).toBe(21);
    expect(clampTrialDays(30)).toBe(30);
  });

  it("clamps values over 30 to 30", () => {
    expect(clampTrialDays(31)).toBe(30);
    expect(clampTrialDays(60)).toBe(30);
    expect(clampTrialDays(365)).toBe(30);
    expect(clampTrialDays(Number.MAX_SAFE_INTEGER)).toBe(30);
  });

  it("clamps negative values to 0", () => {
    expect(clampTrialDays(-1)).toBe(0);
    expect(clampTrialDays(-30)).toBe(0);
  });

  it("clamps non-finite values to 0", () => {
    expect(clampTrialDays(Infinity)).toBe(0);
    expect(clampTrialDays(-Infinity)).toBe(0);
    expect(clampTrialDays(NaN)).toBe(0);
  });

  it("floors fractional values", () => {
    expect(clampTrialDays(7.9)).toBe(7);
    expect(clampTrialDays(30.9)).toBe(30);
  });
});

describe("resolveTrialDaysFromConfig — default", () => {
  beforeEach(() => {
    delete process.env.DEFAULT_TRIAL_DAYS;
    delete process.env.STRIPE_TRIAL_PERIOD_DAYS;
    delete process.env.TRIAL_DAYS_BY_CAMPAIGN;
    delete process.env.TRIAL_DAYS_BY_SOURCE;
  });

  it("returns 0 when no env vars are set (no trial by default)", () => {
    expect(resolveTrialDaysFromConfig()).toBe(0);
  });

  it("returns DEFAULT_TRIAL_DAYS when set", () => {
    process.env.DEFAULT_TRIAL_DAYS = "7";
    expect(resolveTrialDaysFromConfig()).toBe(7);
  });

  it("falls back to STRIPE_TRIAL_PERIOD_DAYS for backward compatibility", () => {
    process.env.STRIPE_TRIAL_PERIOD_DAYS = "14";
    expect(resolveTrialDaysFromConfig()).toBe(14);
  });

  it("prefers DEFAULT_TRIAL_DAYS over STRIPE_TRIAL_PERIOD_DAYS", () => {
    process.env.DEFAULT_TRIAL_DAYS = "21";
    process.env.STRIPE_TRIAL_PERIOD_DAYS = "7";
    expect(resolveTrialDaysFromConfig()).toBe(21);
  });

  it("enforces 30-day maximum on DEFAULT_TRIAL_DAYS", () => {
    process.env.DEFAULT_TRIAL_DAYS = "99";
    expect(resolveTrialDaysFromConfig()).toBe(30);
  });

  it("rejects negative DEFAULT_TRIAL_DAYS", () => {
    process.env.DEFAULT_TRIAL_DAYS = "-5";
    expect(resolveTrialDaysFromConfig()).toBe(0);
  });

  it("rejects non-numeric DEFAULT_TRIAL_DAYS gracefully", () => {
    process.env.DEFAULT_TRIAL_DAYS = "banana";
    expect(resolveTrialDaysFromConfig()).toBe(0);
  });
});

describe("resolveTrialDaysFromConfig — campaign override", () => {
  beforeEach(() => {
    process.env.DEFAULT_TRIAL_DAYS = "7";
    process.env.TRIAL_DAYS_BY_CAMPAIGN = JSON.stringify({
      "dentist-campaign": 14,
      "school-autumn-2026": 21,
      "qr-launch-30": 30,
      "over-limit": 99,
    });
    delete process.env.TRIAL_DAYS_BY_SOURCE;
  });

  it("returns 14-day trial for a dentist campaign", () => {
    expect(resolveTrialDaysFromConfig("dentist-campaign")).toBe(14);
  });

  it("returns 21-day trial for a school campaign", () => {
    expect(resolveTrialDaysFromConfig("school-autumn-2026")).toBe(21);
  });

  it("returns 30-day trial for a QR launch campaign", () => {
    expect(resolveTrialDaysFromConfig("qr-launch-30")).toBe(30);
  });

  it("enforces 30-day ceiling even when campaign config says more", () => {
    expect(resolveTrialDaysFromConfig("over-limit")).toBe(30);
  });

  it("unknown campaign falls back to DEFAULT_TRIAL_DAYS", () => {
    expect(resolveTrialDaysFromConfig("completely-unknown-campaign")).toBe(7);
  });

  it("missing campaignId falls back to DEFAULT_TRIAL_DAYS", () => {
    expect(resolveTrialDaysFromConfig()).toBe(7);
    expect(resolveTrialDaysFromConfig(null)).toBe(7);
    expect(resolveTrialDaysFromConfig(undefined)).toBe(7);
  });
});

describe("resolveTrialDaysFromConfig — acquisition source override", () => {
  beforeEach(() => {
    process.env.DEFAULT_TRIAL_DAYS = "7";
    delete process.env.TRIAL_DAYS_BY_CAMPAIGN;
    process.env.TRIAL_DAYS_BY_SOURCE = JSON.stringify({
      "qr-poster": 30,
      "partner-email": 14,
    });
  });

  it("returns 30-day trial for qr-poster source", () => {
    expect(resolveTrialDaysFromConfig(undefined, "qr-poster")).toBe(30);
  });

  it("returns 14-day trial for partner-email source", () => {
    expect(resolveTrialDaysFromConfig(undefined, "partner-email")).toBe(14);
  });

  it("unknown source falls back to DEFAULT_TRIAL_DAYS", () => {
    expect(resolveTrialDaysFromConfig(undefined, "unknown-source")).toBe(7);
  });
});

describe("resolveTrialDaysFromConfig — campaign takes priority over source", () => {
  beforeEach(() => {
    process.env.DEFAULT_TRIAL_DAYS = "7";
    process.env.TRIAL_DAYS_BY_CAMPAIGN = JSON.stringify({ "campaign-a": 14 });
    process.env.TRIAL_DAYS_BY_SOURCE = JSON.stringify({ "qr-poster": 30 });
  });

  it("campaign match takes priority over source match", () => {
    // campaign → 14 days; source → 30 days; campaign wins
    expect(resolveTrialDaysFromConfig("campaign-a", "qr-poster")).toBe(14);
  });

  it("falls through to source when campaign is unknown", () => {
    expect(resolveTrialDaysFromConfig("unknown-campaign", "qr-poster")).toBe(30);
  });
});

describe("resolveTrialDaysFromConfig — malformed config", () => {
  it("handles malformed TRIAL_DAYS_BY_CAMPAIGN gracefully", () => {
    process.env.DEFAULT_TRIAL_DAYS = "7";
    process.env.TRIAL_DAYS_BY_CAMPAIGN = "NOT_VALID_JSON";
    // Should fall back to default without throwing
    expect(resolveTrialDaysFromConfig("some-campaign")).toBe(7);
  });

  it("handles non-object TRIAL_DAYS_BY_CAMPAIGN gracefully", () => {
    process.env.DEFAULT_TRIAL_DAYS = "7";
    process.env.TRIAL_DAYS_BY_CAMPAIGN = '"just-a-string"';
    expect(resolveTrialDaysFromConfig("some-campaign")).toBe(7);
  });
});

describe("browser-cannot-choose-duration — structural contract", () => {
  it("resolveTrialDaysFromConfig takes no duration argument — caller cannot inject days", () => {
    // The function signature accepts only optional campaignId and acquisitionSource.
    // There is no parameter for the browser to supply arbitrary trial days.
    // This test documents that contract.
    const result = resolveTrialDaysFromConfig;
    // Verify the function takes at most 2 arguments — neither is a duration
    expect(result.length).toBeLessThanOrEqual(2);
  });
});
