/**
 * `£12.00`-style formatting from Stripe minor units. Deliberately its own
 * module (not part of lib/stripe.ts) so client components — the cart,
 * which needs this for display — can import it without pulling the
 * `stripe` SDK itself into the browser bundle. lib/stripe.ts re-exports
 * this for its existing (server-only) callers.
 */
export function formatPrice(unitAmount: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(unitAmount / 100);
}
