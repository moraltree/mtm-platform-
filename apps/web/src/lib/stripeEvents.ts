/**
 * Content subscriptions (PostgreSQL + /api/subscriptions/webhook) are never
 * handled by the dormant merchandise webhook: neither Phase 1-5 objects
 * (metadata.mtm) nor objects from the superseded Sanity-subscription design
 * (metadata.checkoutType, production commit 6746516). Sanity is not a
 * subscription or entitlement authority.
 */
export function isContentSubscriptionObject(object: unknown): boolean {
  const metadata = (object as { metadata?: Record<string, string> } | null)
    ?.metadata;
  return (
    metadata?.mtm === "subscriptions-v1" ||
    metadata?.checkoutType === "subscription"
  );
}
