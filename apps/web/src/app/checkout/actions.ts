"use server";

import { headers } from "next/headers";
import { isStripeConfigured, stripe } from "@/lib/stripe";
import { getProducts } from "@/lib/sanity/queries";
import type { CartItem } from "@/lib/cart";

export interface CheckoutResult {
  url?: string;
  error?: string;
}

// Best-effort, single-instance rate limiting — same caveat as
// ContactForm/actions.ts's submissionsByIp: resets on restart, no shared
// store across serverless instances yet (see CLAUDE.md's guidance note).
const attemptsByIp = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 10;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (attemptsByIp.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  recent.push(now);
  attemptsByIp.set(ip, recent);
  return recent.length > RATE_LIMIT_MAX;
}

/**
 * Turns the client-side cart (lib/cart.ts) into a real Stripe Checkout
 * Session and returns its hosted URL for the browser to redirect to.
 *
 * Security invariant: the charge amount always comes from Stripe's own
 * stored Price (looked up by `price: <stripePriceId>` — never a
 * client-supplied amount), and every `stripePriceId` is additionally
 * cross-checked against the current active product catalogue before use,
 * so a tampered localStorage cart can at worst reference a real, active
 * product in this Stripe account — never an arbitrary amount or an
 * inactive/removed product.
 */
export async function createCheckoutSession(
  items: CartItem[],
): Promise<CheckoutResult> {
  if (!isStripeConfigured || !stripe) {
    return {
      error: "The shop isn't fully set up yet — checkout is unavailable.",
    };
  }

  if (!items || items.length === 0) {
    return { error: "Your cart is empty." };
  }

  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  if (isRateLimited(ip)) {
    return { error: "Too many attempts — please try again in a few minutes." };
  }

  const products = await getProducts();
  const validPriceIds = new Set(
    (products ?? []).map((product) => product.stripePriceId),
  );
  const validItems = items.filter((item) =>
    validPriceIds.has(item.stripePriceId),
  );

  if (validItems.length === 0) {
    return { error: "None of the items in your cart are currently available." };
  }

  // Stripe Checkout allows a one-off Price alongside recurring Price(s) in
  // "subscription" mode (the recurring item becomes the subscription; the
  // one-time item bills once alongside it), but the reverse — a recurring
  // Price in "payment" mode — is rejected. So: any subscription item
  // present -> "subscription" mode. Reasoned through against
  // node_modules/stripe's SessionCreateParams types, not verified against
  // a live account (no Stripe credentials available in this environment).
  const hasSubscriptionItem = validItems.some(
    (item) => item.priceType === "subscription",
  );
  const mode = hasSubscriptionItem ? "subscription" : "payment";

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  try {
    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: validItems.map((item) => ({
        price: item.stripePriceId,
        // Clamp defensively — the cart UI already clamps to 1-99, this is
        // the server-side backstop for a directly-invoked/tampered call.
        quantity: Math.max(1, Math.min(99, Math.floor(item.quantity) || 1)),
      })),
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/checkout/cancelled`,
      billing_address_collection: "auto",
    });

    if (!session.url) {
      return {
        error: "Something went wrong starting checkout. Please try again.",
      };
    }

    return { url: session.url };
  } catch (error) {
    console.error("Stripe Checkout Session creation failed:", error);
    return {
      error: "Something went wrong starting checkout. Please try again.",
    };
  }
}
