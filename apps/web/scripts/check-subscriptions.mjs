import nextEnv from "@next/env";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";
import pg from "pg";
import { databaseConfig } from "../src/lib/database/policy.mjs";
import { stripeConfigIssues } from "../src/lib/subscriptions/stripeConfig.mjs";
import { loadMigrations } from "./lib/migrations.mjs";
import { checkDatabase } from "./lib/readiness.mjs";

// Read-only readiness check. Values, connection strings and provider error
// bodies are never printed. Stripe calls are GET requests only.
nextEnv.loadEnvConfig(fileURLToPath(new URL("..", import.meta.url)));
const names = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_ACCOUNT_ID",
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
const issues = stripeConfigIssues(process.env);
for (const issue of issues) console.log(`Stripe configuration: ${issue}`);
if (issues.length) process.exitCode = 1;

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
    // Proves the key belongs to the intended account (two local TEST
    // configurations were found pointing at different accounts).
    try {
      const account = await stripe.accounts.retrieve();
      const match = account.id === process.env.STRIPE_ACCOUNT_ID;
      console.log(
        `Stripe account: ${match ? "matches STRIPE_ACCOUNT_ID" : "MISMATCH with STRIPE_ACCOUNT_ID"}`,
      );
      if (!match) process.exitCode = 1;
    } catch {
      console.log(
        "Stripe account: UNVERIFIED (key cannot read its account; grant Account read or use the secret key for this check)",
      );
      process.exitCode = 1;
    }
    const currencies = new Set();
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
        currencies.add(price.currency);
        console.log(`${name}: valid active test recurring price`);
      } catch {
        console.log(
          `${name}: validation FAILED (missing, inactive, wrong interval or another account)`,
        );
        process.exitCode = 1;
      }
    }
    if (currencies.size > 1) {
      console.log(
        "Stripe Prices: FAILED (monthly and annual currencies differ)",
      );
      process.exitCode = 1;
    }
  } catch {
    console.log(
      "Stripe test authentication: FAILED (key/network/account permissions)",
    );
    process.exitCode = 1;
  }
}

if (process.env.SUBSCRIPTIONS_DATABASE_URL) {
  let pool;
  try {
    // No startup parameters (this URL is the pooled endpoint); read-only is
    // enforced per transaction instead (scripts/lib/readiness.mjs).
    pool = new pg.Pool(databaseConfig(process.env.SUBSCRIPTIONS_DATABASE_URL));
    pool.on("error", () => {});
    const client = await pool.connect();
    try {
      const { state, freeSelection } = await checkDatabase(
        client,
        await loadMigrations(),
      );
      const latest = state.applied.at(-1)?.version ?? "none";
      console.log(
        `Migrations: latest applied ${latest}; pending ${state.pending.map((m) => m.version).join(", ") || "none"}`,
      );
      for (const p of state.problems) console.log(`Migrations: PROBLEM ${p}`);
      if (state.pending.length || state.problems.length) process.exitCode = 1;
      if (freeSelection !== null) {
        console.log(`Free story selection: ${freeSelection}/30 minimum`);
        if (freeSelection < 30) process.exitCode = 1;
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.log(
      error?.name === "DatabaseConfigError"
        ? `Subscription database: REFUSED (${error.message})`
        : "Subscription database/readiness: FAILED (connection or permissions)",
    );
    process.exitCode = 1;
  } finally {
    await pool?.end();
  }
}
