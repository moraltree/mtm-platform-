import type { PoolClient } from "pg";
import { recordEvent, type Account, transaction } from "./db";
import { trialDeadline } from "./policy";

export async function beginTrial(
  db: PoolClient,
  account: Account,
  start = new Date(),
) {
  if (account.trial_status !== "offered") return;
  const selection = await db.query(
    "SELECT count(*)::int AS count FROM mtm_library WHERE published=true AND free_selection=true",
  );
  if (account.trial_days > 0 && selection.rows[0].count < 30)
    throw new Error("The free selection needs at least 30 published stories");
  const end = trialDeadline(start, account.trial_days);
  const status = account.trial_days === 0 ? "expired" : "active";
  await db.query(
    "UPDATE mtm_accounts SET trial_status=$2,trial_start=$3,trial_end=$4 WHERE id=$1",
    [account.id, status, start, end],
  );
  account.trial_start = start;
  account.trial_end = end;
  account.trial_status = status;
  if (status === "active") {
    await recordEvent(
      db,
      account.id,
      `trial-start:${account.id}`,
      "TRIAL_STARTED",
      { endsAt: end },
    );
    await recordEvent(
      db,
      account.id,
      `trial-active:${account.id}`,
      "TRIAL_ACTIVE",
      { endsAt: end },
    );
  } else {
    await recordEvent(
      db,
      account.id,
      `trial-expired:${account.id}`,
      "TRIAL_EXPIRED",
    );
  }
}

/** Safe to invoke on reads and from an external daily scheduler. */
export async function expireTrials() {
  await transaction(async (db) => {
    const expired = await db.query<Account>(
      "UPDATE mtm_accounts SET trial_status='expired' WHERE trial_status='active' AND trial_end<=now() RETURNING *",
    );
    for (const account of expired.rows)
      await recordEvent(
        db,
        account.id,
        `trial-expired:${account.id}`,
        "TRIAL_EXPIRED",
      );
  });
}
