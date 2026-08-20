/**
 * The default, neutral copy `/campaign-unavailable` shows per reason —
 * deliberately generic (lifecycle-category-based, never partner- or
 * Story-World-specific) so the page never needs per-tenant branching to
 * stay accurate. A future admin can override the body text for one
 * specific campaign via `Campaign.unavailableMessage`
 * (campaign.ts's field comment) without this mapping ever needing a
 * partner-specific entry — see `/campaign-unavailable/page.tsx`'s doc
 * comment for how the two combine.
 *
 * Deliberately no offer/CTA copy anywhere here — per the Phase 5 brief,
 * this page must never imply a free trial or alternative offer is
 * available unless configuration explicitly says so, and no such
 * configuration exists yet.
 */

export type UnavailableReason =
  "draft" | "scheduled" | "paused" | "expired" | "archived" | "source-disabled";

export interface UnavailableCopy {
  heading: string;
  body: string;
}

const REASON_COPY: Record<UnavailableReason, UnavailableCopy> = {
  draft: {
    heading: "Not published yet",
    body: "This campaign isn't live yet.",
  },
  scheduled: {
    heading: "Not open yet",
    body: "This campaign hasn't started yet — please check back soon.",
  },
  paused: {
    heading: "Temporarily unavailable",
    body: "This campaign is temporarily paused. Please check back later.",
  },
  expired: {
    heading: "This offer has ended",
    body: "This campaign is no longer running.",
  },
  archived: {
    heading: "No longer available",
    body: "This campaign has been retired and is no longer available.",
  },
  "source-disabled": {
    heading: "This link is no longer active",
    body: "This particular link has been switched off.",
  },
};

/** Used when `reason` is missing or unrecognised — still a real,
 * informative page, never an error. */
const DEFAULT_COPY: UnavailableCopy = {
  heading: "Currently unavailable",
  body: "This offer is currently unavailable.",
};

export function isUnavailableReason(
  value: unknown,
): value is UnavailableReason {
  return typeof value === "string" && value in REASON_COPY;
}

export function getUnavailableCopy(reason: unknown): UnavailableCopy {
  return isUnavailableReason(reason) ? REASON_COPY[reason] : DEFAULT_COPY;
}
