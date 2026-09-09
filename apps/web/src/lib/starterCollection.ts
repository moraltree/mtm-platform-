/**
 * The Starter Collection — the curated subset of content available to
 * free-trial subscribers.
 *
 * Trial subscribers receive access to the Starter Collection only.
 * Full-library access requires an active paid subscription.
 *
 * Story worlds are configured via the STARTER_COLLECTION_STORY_WORLDS
 * env var (comma-separated slugs). Defaults to "savannah-seven".
 * The content team expands this list as the catalogue grows.
 */

import type { SubscriptionRecord } from "./subscriptionEntitlement";
import { hasPaidSubscriptionAccess, hasTrialAccess } from "./subscriptionEntitlement";

export const STARTER_COLLECTION_STORY_WORLDS: readonly string[] = (
  process.env.STARTER_COLLECTION_STORY_WORLDS ?? "savannah-seven"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Returns true if the given Story World slug is part of the Starter
 * Collection available to free-trial subscribers.
 */
export function isInStarterCollection(storyWorldSlug: string): boolean {
  return STARTER_COLLECTION_STORY_WORLDS.includes(storyWorldSlug);
}

/**
 * Returns true if the subscription record grants access to Starter
 * Collection content.
 *
 * - Active paid subscriber (status="active") → true (full library includes the Starter Collection)
 * - Active non-expired trial (status="trialing", trialEnd in future) → true
 * - Expired trial (status="trialing", trialEnd in past) → false
 * - Cancelled / past_due / incomplete / unknown → false
 *
 * For full-library (non-starter) content, use hasPaidSubscriptionAccess() directly.
 * A trial subscriber with Starter Collection access must never satisfy
 * hasPaidSubscriptionAccess() — these are distinct entitlement tiers.
 */
export function hasStarterCollectionAccess(record: SubscriptionRecord): boolean {
  if (hasPaidSubscriptionAccess(record.status)) return true;
  return hasTrialAccess(record.status, record.trialEnd);
}
