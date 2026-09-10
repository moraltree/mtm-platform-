import nextEnv from "@next/env";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";
import pg from "pg";

// Values and provider error bodies are never printed. Safe for local readiness checks.
nextEnv.loadEnvConfig(fileURLToPath(new URL("..", import.meta.url)));
const names = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_MONTHLY",
  "STRIPE_PRICE_ANNUAL",
  "SUBSCRIPTIONS_DATABASE_URL",
  "RESEND_API_KEY",
  "CONTACT_FORM_FROM_EMAIL",
  "LIBRARY_AUDIO_ORIGIN",
  "LIBRARY_AUDIO_TOKEN",
];
for (const name of names)
  console.log(`${name}: ${process.env[name] ? "configured" : "missing"}`);
const key = process.env.STRIPE_SECRET_KEY;
if (!key) console.log("Stripe test authentication: NOT RUN (key missing)");
else if (!/^(sk|rk)_test_/.test(key)) {
  console.log("Stripe test authentication: REFUSED (key is not a test key)");
  process.exitCode = 1;
} else {
  const stripe = new Stripe(key, {
    apiVersion: "2026-07-29.dahlia",
    timeout: 15000,
    maxNetworkRetries: 0,
  });
  try {
    const balance = await stripe.balance.retrieve();
    if (balance.livemode) throw new Error("Live response");
    console.log("Stripe test authentication: SUCCESS");
    for (const [name, interval] of [
      ["STRIPE_PRICE_MONTHLY", "month"],
      ["STRIPE_PRICE_ANNUAL", "year"],
    ]) {
      if (!process.env[name]) continue;
      try {
        const price = await stripe.prices.retrieve(process.env[name]);
        if (
          price.livemode ||
          !price.active ||
          price.recurring?.interval !== interval ||
          price.recurring.interval_count !== 1 ||
          price.unit_amount <= 0 ||
          price.unit_amount == null ||
          price.recurring.usage_type !== "licensed"
        )
          throw new Error("Invalid price");
        console.log(`${name}: valid active test recurring price`);
      } catch {
        console.log(`${name}: validation FAILED`);
        process.exitCode = 1;
      }
    }
  } catch {
    console.log(
      "Stripe test authentication: FAILED (key/network/account permissions)",
    );
    process.exitCode = 1;
  }
}
if (process.env.SUBSCRIPTIONS_DATABASE_URL) {
  const pool = new pg.Pool({
    connectionString: process.env.SUBSCRIPTIONS_DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  try {
    const result = await pool.query(
      "SELECT count(*)::int AS count FROM mtm_library WHERE published=true AND free_selection=true",
    );
    console.log(`Free story selection: ${result.rows[0].count}/30 minimum`);
    if (result.rows[0].count < 30) process.exitCode = 1;
  } catch {
    console.log(
      "Subscription database/readiness: FAILED (connection or migration missing)",
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
