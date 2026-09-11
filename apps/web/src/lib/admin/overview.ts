import "server-only";
import { database } from "@/lib/subscriptions/db";
import { testSecret } from "@/lib/subscriptions/policy";
import { utcWindows, conversionRate } from "./policy";
import {
  countsSql,
  statusSql,
  paymentsSql,
  activitySql,
  healthSql,
} from "./queries";
import { authorizeAdmin } from "./auth";

export interface Counts {
  accounts: number;
  paid: number;
  trials: number;
  canceled_accounts: number;
  trials_started: number;
  converted: number;
  monthly: number;
  annual: number;
}
export interface Overview {
  asOf: string;
  counts: Counts;
  conversionRate: number | null;
  statuses: { status: string; count: number }[];
  payments: { today: number; week: number; month: number; lifetime: number };
  activity: {
    kind: "registration" | "payment" | "conversion" | "cancellation";
    at: string;
  }[];
  health: {
    database: true;
    testBillingConfigured: boolean;
    lastWebhook: string | null;
    receipts: number;
    failedPayments: number;
    deduplication: boolean;
  };
}

/** One consistent snapshot, bounded activity and query time, no provider calls or writes. */
export async function readOverview(now = new Date()): Promise<Overview> {
  const db = await database().connect();
  try {
    await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await db.query("SET LOCAL statement_timeout = '5s'");
    const windows = utcWindows(now);
    const counts = (await db.query<Counts>(countsSql, [now])).rows[0];
    const statuses = (await db.query(statusSql)).rows;
    const payments = (
      await db.query(paymentsSql, [
        now,
        windows.today,
        windows.week,
        windows.month,
      ])
    ).rows[0];
    const activity = (await db.query(activitySql, [now])).rows.map((r) => ({
      kind: r.kind,
      at: r.occurred_at.toISOString(),
    }));
    const health = (await db.query(healthSql, [now])).rows[0];
    await db.query("COMMIT");
    return {
      asOf: now.toISOString(),
      counts,
      conversionRate: conversionRate(counts.converted, counts.trials_started),
      statuses,
      payments,
      activity,
      health: {
        database: true,
        testBillingConfigured:
          testSecret(process.env.STRIPE_SECRET_KEY) &&
          /^whsec_\w+$/.test(process.env.STRIPE_WEBHOOK_SECRET ?? "") &&
          Boolean(
            process.env.STRIPE_PRICE_MONTHLY?.startsWith("price_") &&
            process.env.STRIPE_PRICE_ANNUAL?.startsWith("price_") &&
            process.env.STRIPE_PRICE_MONTHLY !==
              process.env.STRIPE_PRICE_ANNUAL,
          ),
        lastWebhook: health.last_webhook?.toISOString() ?? null,
        receipts: health.receipts,
        failedPayments: health.failed_payments,
        deduplication: health.receipt_key && health.billing_key,
      },
    };
  } catch (error) {
    await db.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    db.release();
  }
}

export type AdminOverviewResult =
  | { status: "denied" }
  | { status: "unavailable" }
  | { status: "ready"; role: "founder" | "admin"; overview: Overview };

export async function getAdminOverview(): Promise<AdminOverviewResult> {
  try {
    const admin = await authorizeAdmin();
    if (!admin) return { status: "denied" };
    return {
      status: "ready",
      role: admin.role,
      overview: await readOverview(),
    };
  } catch {
    // Never serialize/log provider errors, connection strings or account data.
    return { status: "unavailable" };
  }
}
