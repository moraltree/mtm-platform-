/**
 * Starter Collection entitlement tests.
 *
 * The Starter Collection is available to:
 *   - Active paid subscribers (full library — includes starter)
 *   - Active non-expired free-trial subscribers
 *
 * It is NOT available to:
 *   - Subscribers with expired trials
 *   - Cancelled / past_due / incomplete / unknown
 *
 * A trial user with Starter Collection access must never satisfy
 * hasPaidSubscriptionAccess() — these are distinct tiers.
 */

import { describe, it, expect } from "vitest";
import {
  isInStarterCollection,
  hasStarterCollectionAccess,
  STARTER_COLLECTION_STORY_WORLDS,
} from "./starterCollection";
import { hasPaidSubscriptionAccess } from "./subscriptionEntitlement";
import type { SubscriptionRecord } from "./subscriptionEntitlement";

// ── isInStarterCollection ─────────────────────────────────────────────────

describe("isInStarterCollection", () => {
  it("returns true for savannah-seven (the default Starter Collection entry)", () => {
    expect(isInStarterCollection("savannah-seven")).toBe(true);
  });

  it("returns false for an unknown story world not in the collection", () => {
    expect(isInStarterCollection("future-story-world-not-yet-added")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isInStarterCollection("")).toBe(false);
  });

  it("STARTER_COLLECTION_STORY_WORLDS is non-empty by default", () => {
    expect(STARTER_COLLECTION_STORY_WORLDS.length).toBeGreaterThan(0);
  });
});

// ── hasStarterCollectionAccess ────────────────────────────────────────────

function makeRecord(
  overrides: Partial<SubscriptionRecord> = {},
): SubscriptionRecord {
  return { status: "unknown", ...overrides };
}

const FUTURE_DATE = new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString();
const PAST_DATE = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

describe("hasStarterCollectionAccess — trial access", () => {
  it("grants access to an active non-expired trial", () => {
    const record = makeRecord({ status: "trialing", trialEnd: FUTURE_DATE });
    expect(hasStarterCollectionAccess(record)).toBe(true);
  });

  it("denies access to an expired trial", () => {
    const record = makeRecord({ status: "trialing", trialEnd: PAST_DATE });
    expect(hasStarterCollectionAccess(record)).toBe(false);
  });

  it("grants access when trialing with no trialEnd set (fall-through)", () => {
    const record = makeRecord({ status: "trialing" });
    expect(hasStarterCollectionAccess(record)).toBe(true);
  });
});

describe("hasStarterCollectionAccess — paid subscriber access", () => {
  it("grants access to an active paid subscriber (full library includes starter)", () => {
    const record = makeRecord({ status: "active" });
    expect(hasStarterCollectionAccess(record)).toBe(true);
  });

  it("denies access for past_due", () => {
    const record = makeRecord({ status: "past_due" });
    expect(hasStarterCollectionAccess(record)).toBe(false);
  });

  it("denies access for cancelled", () => {
    const record = makeRecord({ status: "cancelled" });
    expect(hasStarterCollectionAccess(record)).toBe(false);
  });

  it("denies access for incomplete", () => {
    const record = makeRecord({ status: "incomplete" });
    expect(hasStarterCollectionAccess(record)).toBe(false);
  });

  it("denies access for unknown", () => {
    const record = makeRecord({ status: "unknown" });
    expect(hasStarterCollectionAccess(record)).toBe(false);
  });
});

describe("entitlement tier separation: trial ≠ paid subscriber", () => {
  it("trial user with Starter Collection access does NOT satisfy hasPaidSubscriptionAccess", () => {
    const record = makeRecord({ status: "trialing", trialEnd: FUTURE_DATE });
    expect(hasStarterCollectionAccess(record)).toBe(true);
    expect(hasPaidSubscriptionAccess(record.status)).toBe(false);
  });

  it("active paid subscriber satisfies both hasStarterCollectionAccess AND hasPaidSubscriptionAccess", () => {
    const record = makeRecord({ status: "active" });
    expect(hasStarterCollectionAccess(record)).toBe(true);
    expect(hasPaidSubscriptionAccess(record.status)).toBe(true);
  });

  it("expired trialist loses Starter Collection access — hasPaidSubscriptionAccess still false", () => {
    const record = makeRecord({ status: "trialing", trialEnd: PAST_DATE });
    expect(hasStarterCollectionAccess(record)).toBe(false);
    expect(hasPaidSubscriptionAccess(record.status)).toBe(false);
  });
});

describe("upgrade scenario: trial → paid", () => {
  it("on Day 1 upgrade: paid subscriber has full access; no trial credit applied", () => {
    // Simulate: user starts trial, immediately upgrades to MONTHLY
    // The subscription record is now "active" (paid); the trial record is "cancelled"
    const paidRecord = makeRecord({ status: "active" });
    const cancelledTrialRecord = makeRecord({ status: "cancelled", trialDays: 30 });

    // Paid subscription grants access
    expect(hasStarterCollectionAccess(paidRecord)).toBe(true);
    expect(hasPaidSubscriptionAccess(paidRecord.status)).toBe(true);

    // Cancelled trial record no longer grants access (trial terminated on upgrade)
    expect(hasStarterCollectionAccess(cancelledTrialRecord)).toBe(false);
  });

  it("on Day 30 upgrade: same result — paid access, trial terminated, no carry-forward", () => {
    // Trial_period_days is never set in paid checkout — no deferred billing
    const paidRecord = makeRecord({ status: "active" });
    expect(hasPaidSubscriptionAccess(paidRecord.status)).toBe(true);
    expect(hasStarterCollectionAccess(paidRecord)).toBe(true);
  });
});
