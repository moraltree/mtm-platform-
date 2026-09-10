import nextEnv from "@next/env";
import { fileURLToPath } from "node:url";
import pg from "pg";
nextEnv.loadEnvConfig(fileURLToPath(new URL("..", import.meta.url)));
if (
  process.env.SUBSCRIPTIONS_ENABLED !== "true" ||
  !process.env.SUBSCRIPTIONS_DATABASE_URL
)
  throw new Error("Subscriptions are not configured");
const pool = new pg.Pool({
  connectionString: process.env.SUBSCRIPTIONS_DATABASE_URL,
});
const db = await pool.connect();
try {
  await db.query("BEGIN");
  await db.query(`WITH expired AS (
    UPDATE mtm_accounts SET trial_status='expired' WHERE trial_status='active' AND trial_end<=now() RETURNING id,registration
  ) INSERT INTO mtm_billing_events(event_key,user_id,type,data)
    SELECT 'trial-expired:'||id,id,'TRIAL_EXPIRED',jsonb_build_object('campaignId',registration->'campaignId','attribution',registration->'attribution') FROM expired ON CONFLICT DO NOTHING`);
  await db.query("DELETE FROM mtm_sessions WHERE expires_at<=now()");
  await db.query(
    "DELETE FROM mtm_login_tokens WHERE expires_at<now()-interval '1 day'",
  );
  await db.query("COMMIT");
  console.log(
    "Trial expiry and expired authentication record cleanup completed",
  );
} catch {
  await db.query("ROLLBACK");
  console.error("Trial maintenance failed; retry required");
  process.exitCode = 1;
} finally {
  db.release();
  await pool.end();
}
