import Stripe from "stripe";
import { parsePlan, testSecret, type Plan } from "./policy";

export const enabled = () => process.env.SUBSCRIPTIONS_ENABLED === "true";

export function origin() {
  const url = new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  );
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  ) {
    throw new Error("Subscription origin must use HTTPS or localhost");
  }
  return url.origin;
}

export function billingStripe() {
  if (!enabled() || !testSecret(process.env.STRIPE_SECRET_KEY))
    throw new Error("Stripe test billing is not configured");
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-07-29.dahlia",
    maxNetworkRetries: 2,
    timeout: 15000,
  });
}

export function priceId(plan: Plan) {
  parsePlan(plan);
  const id =
    process.env[
      plan === "monthly" ? "STRIPE_PRICE_MONTHLY" : "STRIPE_PRICE_ANNUAL"
    ];
  if (!id?.startsWith("price_"))
    throw new Error("Subscription price is not configured");
  if (process.env.STRIPE_PRICE_MONTHLY === process.env.STRIPE_PRICE_ANNUAL)
    throw new Error("Plans must have distinct prices");
  return id;
}

export async function checkedPrice(stripe: Stripe, plan: Plan) {
  const price = await stripe.prices.retrieve(priceId(plan));
  if (
    price.livemode ||
    !price.active ||
    price.type !== "recurring" ||
    price.recurring?.interval !== (plan === "monthly" ? "month" : "year") ||
    price.recurring.interval_count !== 1 ||
    price.recurring.usage_type !== "licensed" ||
    price.unit_amount == null ||
    price.unit_amount <= 0
  ) {
    throw new Error("Invalid test subscription price");
  }
  return price;
}

export function trialOptions() {
  for (const name of ["TRIAL_CARD_REQUIRED", "TRIAL_AUTO_CONVERT"]) {
    if (process.env[name] && !["true", "false"].includes(process.env[name]!))
      throw new Error("Invalid trial configuration");
  }
  const autoConvert = process.env.TRIAL_AUTO_CONVERT === "true";
  return {
    autoConvert,
    cardRequired: autoConvert || process.env.TRIAL_CARD_REQUIRED === "true",
  };
}
