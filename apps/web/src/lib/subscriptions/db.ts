import { Pool, type PoolClient } from "pg";

let pool: Pool | undefined;
export function database() {
  if (
    process.env.SUBSCRIPTIONS_ENABLED !== "true" ||
    !process.env.SUBSCRIPTIONS_DATABASE_URL
  ) {
    throw new Error("Subscriptions are not configured");
  }
  return (pool ??= new Pool({
    connectionString: process.env.SUBSCRIPTIONS_DATABASE_URL,
    max: 5,
  }));
}

export async function transaction<T>(
  work: (db: PoolClient) => Promise<T>,
): Promise<T> {
  const db = await database().connect();
  try {
    await db.query("BEGIN");
    const result = await work(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}

export interface Account {
  id: string;
  email: string;
  customer_id: string | null;
  registration: Record<string, unknown>;
  trial_status: string | null;
  trial_start: Date | null;
  trial_end: Date | null;
  trial_days: number;
  card_required: boolean;
  auto_convert: boolean;
  blocked: boolean;
}

export async function recordEvent(
  db: PoolClient,
  userId: string,
  key: string,
  type: string,
  data: object = {},
) {
  await db.query(
    `INSERT INTO mtm_billing_events (event_key,user_id,type,data)
     SELECT $1,id,$3,jsonb_build_object('campaignId',registration->'campaignId','source',registration->'acquisitionSource','offer',registration->'offer','attribution',registration->'attribution','rewardEligibility',registration->'rewardEligibility','details',$4::jsonb)
     FROM mtm_accounts WHERE id=$2 ON CONFLICT DO NOTHING`,
    [key, userId, type, JSON.stringify(data)],
  );
}
