/** Run all web regressions without resetting retained Stripe sandbox acceptance data. */
import { Client } from "pg";
import { randomUUID, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const value = process.env.MTM_TEST_DATABASE_URL;
if (!value)
  throw new Error(
    "Set MTM_TEST_DATABASE_URL to the isolated local subscription test database",
  );
const url = new URL(value);
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  url.port !== "55439" ||
  url.pathname !== "/mtm_subscription_test"
)
  throw new Error("Unsafe test database target");
const db = new Client({
  connectionString: value,
  options: "-c search_path=public",
});
const schema = "mtm_admin_regression_" + randomUUID().replaceAll("-", "");
const tables = [
  "mtm_accounts",
  "mtm_sessions",
  "mtm_login_tokens",
  "mtm_subscriptions",
  "mtm_checkout_attempts",
  "mtm_webhook_events",
  "mtm_billing_events",
  "mtm_library",
];
async function fingerprint() {
  const hash = createHash("sha256");
  for (const table of tables) {
    const exists = (
      await db.query("SELECT to_regclass($1) AS name", ["public." + table])
    ).rows[0].name;
    hash.update(table);
    if (exists)
      hash.update(
        JSON.stringify(
          (
            await db.query(
              `SELECT row_to_json(t)::text AS row FROM public.${table} t ORDER BY row_to_json(t)::text`,
            )
          ).rows,
        ),
      );
  }
  return hash.digest("hex");
}
await db.connect();
const before = await fingerprint();
let code = 1;
try {
  await db.query(`CREATE SCHEMA ${schema}`);
  const env = {
    ...process.env,
    PGOPTIONS: `-c search_path=${schema}`,
    MTM_TEST_DATABASE_URL: value,
    MTM_ADMIN_TEST_DATABASE_URL: value,
  };
  for (const key of Object.keys(env))
    if (/^(STRIPE_|RESEND_|LIBRARY_AUDIO_|ADMIN_ACCOUNT_ROLES)/.test(key))
      delete env[key];
  code = await new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "test"], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (result) => resolve(result ?? 1));
  });
} finally {
  await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  const after = await fingerprint();
  await db.end();
  if (before !== after)
    throw new Error("Retained public acceptance data changed");
  console.log(
    "Retained Stripe acceptance tables unchanged; temporary regression schema removed.",
  );
}
process.exitCode = code;
