import { database } from "./db";
import { entitlement } from "./policy";
import { expireTrials } from "./trials";

export async function accessFor(userId: string) {
  await expireTrials();
  const result = await database().query(
    `SELECT a.blocked,a.trial_status,a.trial_end,s.status,s.paid_until
    FROM mtm_accounts a LEFT JOIN mtm_subscriptions s ON s.user_id=a.id WHERE a.id=$1`,
    [userId],
  );
  const access = result.rows.map((r) =>
    entitlement({
      blocked: r.blocked,
      trialStatus: r.trial_status,
      trialEnd: r.trial_end,
      status: r.status,
      paidUntil: r.paid_until,
    }),
  );
  return access.includes("paid")
    ? "paid"
    : access.includes("trial")
      ? "trial"
      : "none";
}
