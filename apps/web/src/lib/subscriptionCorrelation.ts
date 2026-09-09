/**
 * The cookie that links a visitor's browser session to their Stripe
 * subscription. Set (httpOnly) before redirecting to Stripe Checkout;
 * read server-side on the success page and for Customer Portal access.
 *
 * Security properties:
 * - httpOnly — not readable by client JavaScript
 * - sameSite: lax — follows top-level cross-site navigations (i.e. the
 *   Stripe Checkout return redirect) while blocking third-party fetch
 * - secure in production — not sent over plain HTTP
 *
 * The value is a UUID generated server-side and also passed as
 * `client_reference_id` in the Stripe Checkout Session, so the webhook
 * can write it into the subscription record without ever needing a
 * client-supplied value.
 *
 * This is not an auth token — it does not prove identity, only provides
 * a correlation reference. It lets this visitor manage their own
 * subscription without an account system, by treating "has the cookie"
 * as equivalent to "owns this device." An account system would replace
 * this with a proper session-based auth check.
 */
export const SUBSCRIPTION_CORRELATION_COOKIE = "mtm_sub_ref";

export const CORRELATION_COOKIE_OPTIONS = {
  httpOnly: true as const,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/" as const,
  // 400 days — Chrome's cap; generous since a subscriber should be able
  // to manage their billing from the same device for the life of the
  // subscription without re-identifying themselves.
  maxAge: 400 * 24 * 60 * 60,
};
