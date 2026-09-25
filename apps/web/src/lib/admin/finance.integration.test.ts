import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { runMigrationSql } from "../../../scripts/lib/migrations.mjs";
import { utcWindows } from "./policy";
vi.mock("server-only", () => ({}));
import { readFinance, type Finance } from "./financeSnapshot";
import { testSchemaName } from "../../../scripts/lib/testSchemas.mjs";

const url = process.env.MTM_ADMIN_TEST_DATABASE_URL;
const migration = (name: string) =>
  readFile(new URL(`../../../migrations/${name}`, import.meta.url), "utf8");

describe.skipIf(!url)(
  "Phase 2 finance aggregates against isolated PostgreSQL tables",
  () => {
    let pool: Pool;
    const schemas: string[] = [];
    const now = new Date("2026-09-11T12:00:00Z");
    const schemaPool = async (migrations: string[]) => {
      const schema = testSchemaName("mtm_finance_test_");
      schemas.push(schema);
      const p = new Pool({
        connectionString: url,
        options: `-c search_path=${schema}`,
      });
      await p.query(`CREATE SCHEMA ${schema}`);
      for (const m of migrations) await runMigrationSql(p, await migration(m));
      return p;
    };
    const snapshot = async (at = now, p = pool): Promise<Finance | null> => {
      const db = await p.connect();
      try {
        await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
        const result = await readFinance(db, at, utcWindows(at));
        await db.query("COMMIT");
        return result;
      } finally {
        db.release();
      }
    };
    beforeAll(async () => {
      const parsed = new URL(url!);
      if (
        parsed.hostname !== "127.0.0.1" ||
        parsed.port !== "55439" ||
        parsed.pathname !== "/mtm_subscription_test"
      )
        throw Error("Unsafe database target");
      pool = await schemaPool([
        "001_subscriptions.sql",
        "002_analytics_ledger.sql",
      ]);
    });
    beforeEach(async () => {
      await pool.query(
        "TRUNCATE mtm_accounts,mtm_subscriptions,mtm_billing_events,mtm_webhook_events,mtm_ledger_entries,mtm_ledger_gaps,mtm_subscription_history CASCADE",
      );
      await pool.query(
        "UPDATE mtm_analytics_coverage SET coverage_start='2026-08-01T00:00:00Z',method='webhook'",
      );
    });
    afterAll(async () => {
      if (pool) await pool.end();
      const admin = new Pool({ connectionString: url });
      for (const schema of schemas)
        await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    });
    const coverage = (dataset: string, at: string) =>
      pool.query(
        "UPDATE mtm_analytics_coverage SET coverage_start=$2 WHERE dataset=$1",
        [dataset, at],
      );
    const account = async ({
      blocked = false,
      trial = "offered",
      trialStart = null as string | null,
      trialEnd = null as string | null,
    } = {}) => {
      const id = randomUUID();
      await pool.query(
        "INSERT INTO mtm_accounts(id,email,registration,trial_days,trial_status,trial_start,trial_end,blocked,created_at) VALUES($1,$2,$3,30,$4,$5,$6,$7,'2026-07-01')",
        [
          id,
          `${id}@example.invalid`,
          { secret: "SENTINEL_NOT_FOR_BROWSER" },
          trial,
          trialStart,
          trialEnd,
          blocked,
        ],
      );
      return id;
    };
    const entry = async (
      user: string,
      kind: string,
      amount: number,
      currency: string,
      at: string,
      extra: {
        status?: string;
        plan?: string | null;
        invoice?: string;
        recorded?: string;
      } = {},
    ) => {
      const object = `${kind}_${randomUUID()}`;
      await pool.query(
        `INSERT INTO mtm_ledger_entries(entry_key,provider,kind,user_id,provider_customer_id,provider_invoice_id,provider_object_id,
         amount_minor,currency,status,plan,livemode,provider_occurred_at,occurred_at_source,source,recorded_at)
         VALUES($1,'stripe',$2,$3,'cus_SENTINEL',$4,$5,$6,$7,$8,$9,false,$10,'paid_at','webhook',$11)`,
        [
          `stripe:${object}`,
          kind,
          user,
          extra.invoice ?? (kind === "payment" ? object : null),
          extra.invoice ?? object,
          amount,
          currency,
          extra.status ?? (kind === "payment" ? "paid" : "succeeded"),
          extra.plan === undefined ? "monthly" : extra.plan,
          at,
          extra.recorded ?? "2026-09-01T00:00:00Z",
        ],
      );
    };
    const billing = (user: string, type: string, at: string, objectId = "") =>
      pool.query(
        "INSERT INTO mtm_billing_events(event_key,user_id,type,data,created_at) VALUES($1,$2,$3,$4,$5)",
        [
          randomUUID(),
          user,
          type,
          { details: { objectId }, secret: "SENTINEL_NOT_FOR_BROWSER" },
          at,
        ],
      );
    const window = (f: Finance, period: string) =>
      f.revenue.find((w) => w.period === period)!;

    it("keeps the Phase 1 console working when the ledger migration is absent", async () => {
      const phase1 = await schemaPool(["001_subscriptions.sql"]);
      try {
        expect(await snapshot(now, phase1)).toBeNull();
      } finally {
        await phase1.end();
      }
    });

    it("reports empty data as complete zero-currency windows, not as £0", async () => {
      const f = (await snapshot())!;
      expect(f.revenue.map((w) => [w.period, w.coverage.status])).toEqual([
        ["today", "complete"],
        ["week", "complete"],
        ["month", "complete"],
        ["lifetime", "complete"],
      ]);
      expect(f.revenue.every((w) => w.currencies.length === 0)).toBe(true);
      expect(f.mrr).toEqual({
        status: "available",
        paying: 0,
        priced: 0,
        currencies: [],
      });
      expect(f.mode).toEqual({ testEntries: 0, liveEntries: 0 });
    });

    it("sums per currency with inclusive UTC starts, refunds and lost disputes", async () => {
      const id = await account();
      for (const at of [
        "2026-08-31T23:59:59Z",
        "2026-09-01T00:00:00Z",
        "2026-09-07T00:00:00Z",
        "2026-09-11T00:00:00Z",
      ])
        await entry(id, "payment", 999, "gbp", at);
      await entry(id, "payment", 1000, "gbp", "2026-09-11T12:00:00.001Z"); // After the snapshot.
      await entry(id, "payment", 1000, "gbp", "2026-09-11T11:00:00Z", {
        recorded: "2026-09-11T12:00:01Z", // Recorded after the snapshot.
      });
      await entry(id, "payment", 0, "gbp", "2026-09-11T02:00:00Z");
      await entry(id, "payment", 1500, "usd", "2026-09-11T01:00:00Z");
      await entry(id, "refund", 500, "gbp", "2026-09-11T03:00:00Z");
      await entry(id, "refund", 100, "gbp", "2026-09-11T03:00:00Z", {
        status: "pending",
      });
      await entry(id, "refund", 100, "gbp", "2026-09-11T03:00:00Z", {
        status: "failed",
      });
      await entry(id, "dispute", 1500, "usd", "2026-09-08T00:00:00Z", {
        status: "lost",
      });
      await entry(id, "dispute", 999, "gbp", "2026-09-11T04:00:00Z", {
        status: "needs_response",
      });
      const f = (await snapshot())!;
      const gbp = (period: string) =>
        window(f, period).currencies.find((c) => c.currency === "gbp");
      const usd = (period: string) =>
        window(f, period).currencies.find((c) => c.currency === "usd");
      expect(gbp("today")).toEqual({
        currency: "gbp",
        payments: 1,
        grossMinor: 999,
        refundedMinor: 500,
        disputesLostMinor: 0,
        netMinor: 499,
        pendingRefunds: 1,
        openDisputes: 1,
      });
      expect(usd("today")).toMatchObject({ grossMinor: 1500, netMinor: 1500 });
      expect(gbp("week")).toMatchObject({ payments: 2, grossMinor: 1998 });
      expect(usd("week")).toMatchObject({
        disputesLostMinor: 1500,
        netMinor: 0,
      });
      expect(gbp("month")).toMatchObject({ payments: 3, grossMinor: 2997 });
      expect(gbp("lifetime")).toMatchObject({ payments: 4, grossMinor: 3996 });
      // Never a combined cross-currency figure.
      expect(window(f, "today").currencies).toHaveLength(2);
      expect(f.mode.testEntries).toBeGreaterThan(0);
      const json = JSON.stringify(f);
      expect(json).not.toContain("SENTINEL");
      expect(json).not.toContain(id);
      expect(json).not.toMatch(/payment_|refund_|dispute_|cus_/);
    });

    it("reconciles payment receipts and gaps into explicit partial coverage", async () => {
      await coverage("payment_ledger", "2026-09-05T00:00:00Z");
      const id = await account();
      await billing(id, "PAYMENT_SUCCEEDED", "2026-09-02T00:00:00Z", "in_pre");
      await billing(id, "PAYMENT_SUCCEEDED", "2026-09-10T00:00:00Z", "in_ok");
      await entry(id, "payment", 999, "gbp", "2026-09-10T00:00:00Z", {
        invoice: "in_ok",
      });
      await billing(id, "PAYMENT_SUCCEEDED", "2026-09-10T00:00:00Z", "in_lost");
      await pool.query(
        "INSERT INTO mtm_ledger_gaps(gap_key,user_id,kind,provider_object_id,reason,source_event_id,recorded_at) VALUES('g1',$1,'payment','in_bad','invalid currency','evt_bad','2026-09-11T01:00:00Z')",
        [id],
      );
      let f = (await snapshot())!;
      expect(window(f, "today").coverage.reasons).toHaveLength(1);
      expect(window(f, "week").coverage.reasons).toEqual([
        expect.stringContaining("1 successful-payment receipt(s) since"),
        expect.stringContaining("1 provider object(s)"),
      ]);
      expect(window(f, "month").coverage.reasons).toHaveLength(3);
      expect(window(f, "month").coverage.reasons[0]).toContain(
        "predate ledger coverage",
      );
      expect(window(f, "lifetime").coverage.status).toBe("partial");
      // A later successful record of the missing objects resolves the flags.
      await entry(id, "payment", 999, "gbp", "2026-09-10T00:00:00Z", {
        invoice: "in_lost",
      });
      await entry(id, "payment", 999, "gbp", "2026-09-11T01:00:00Z", {
        invoice: "in_bad",
      });
      f = (await snapshot())!;
      expect(window(f, "week").coverage.status).toBe("complete");
      expect(window(f, "month").coverage.reasons).toHaveLength(1);
    });

    it("splits gross revenue by attributed plan without mixing currencies", async () => {
      const id = await account();
      await entry(id, "payment", 999, "gbp", "2026-09-02T00:00:00Z");
      await entry(id, "payment", 999, "gbp", "2026-08-02T00:00:00Z");
      await entry(id, "payment", 9999, "gbp", "2026-09-03T00:00:00Z", {
        plan: "annual",
      });
      await entry(id, "payment", 500, "gbp", "2026-09-03T00:00:00Z", {
        plan: null,
      });
      await entry(id, "payment", 1299, "usd", "2026-09-03T00:00:00Z");
      const f = (await snapshot())!;
      expect(f.plans).toEqual([
        {
          currency: "gbp",
          plan: "annual",
          monthPayments: 1,
          monthMinor: 9999,
          lifetimePayments: 1,
          lifetimeMinor: 9999,
        },
        {
          currency: "gbp",
          plan: "monthly",
          monthPayments: 1,
          monthMinor: 999,
          lifetimePayments: 2,
          lifetimeMinor: 1998,
        },
        {
          currency: "gbp",
          plan: "unattributed",
          monthPayments: 1,
          monthMinor: 500,
          lifetimePayments: 1,
          lifetimeMinor: 500,
        },
        {
          currency: "usd",
          plan: "monthly",
          monthPayments: 1,
          monthMinor: 1299,
          lifetimePayments: 1,
          lifetimeMinor: 1299,
        },
      ]);
    });

    it("normalises MRR per currency and marks it partial when a contract is missing", async () => {
      const sub = async (
        user: string,
        extra: Partial<{
          status: string;
          paid: string;
          amount: number | null;
          currency: string;
          interval: string;
          quantity: number;
          discounted: boolean;
          canceling: boolean;
        }> = {},
      ) =>
        pool.query(
          `INSERT INTO mtm_subscriptions(stripe_id,user_id,customer_id,plan,status,paid_until,cancel_at_period_end,
           unit_amount_minor,currency,billing_interval,interval_count,quantity,discounted)
           VALUES($1,$2,'cus_fixture',$3,$4,$5,$6,$7,$8,$9,1,$10,$11)`,
          [
            randomUUID(),
            user,
            extra.interval === "year" ? "annual" : "monthly",
            extra.status ?? "active",
            extra.paid ?? "2026-10-01",
            extra.canceling ?? false,
            extra.amount === undefined ? 999 : extra.amount,
            extra.amount === null ? null : (extra.currency ?? "gbp"),
            extra.amount === null ? null : (extra.interval ?? "month"),
            extra.quantity ?? 1,
            extra.amount === null ? null : (extra.discounted ?? false),
          ],
        );
      await sub(await account());
      await sub(await account(), { amount: 11988, interval: "year" });
      await sub(await account(), { amount: 10000, interval: "year" });
      await sub(await account({ blocked: true }));
      await sub(await account(), { status: "canceled" });
      await sub(await account(), { paid: "2026-09-11T12:00:00Z" });
      await sub(await account(), { status: "past_due" });
      await sub(await account(), {
        amount: 1299,
        currency: "usd",
        canceling: true,
      });
      const discounted = await account();
      await sub(discounted, { discounted: true });
      await sub(await account(), { amount: null }); // Pre-migration row, no contract yet.
      let f = (await snapshot())!;
      expect(f.mrr.status).toBe("partial");
      expect(f.mrr.paying).toBe(6);
      expect(f.mrr.priced).toBe(4);
      expect(f.mrr.currencies).toEqual([
        {
          currency: "gbp",
          mrrMinor: 2831,
          cancelingMinor: 0,
          subscriptions: 3,
        },
        {
          currency: "usd",
          mrrMinor: 1299,
          cancelingMinor: 1299,
          subscriptions: 1,
        },
      ]);
      await pool.query(
        "DELETE FROM mtm_subscriptions WHERE unit_amount_minor IS NULL OR discounted",
      );
      f = (await snapshot())!;
      expect(f.mrr.status).toBe("available");
    });

    it("counts lifecycle movements and bounds history-derived counts by coverage", async () => {
      await coverage("subscription_history", "2026-09-05T00:00:00Z");
      const first = await account();
      const second = await account();
      await billing(
        first,
        "PAID_SUBSCRIPTION_CONFIRMED",
        "2026-08-15T00:00:00Z",
      );
      await billing(
        first,
        "PAID_SUBSCRIPTION_CONFIRMED",
        "2026-09-10T00:00:00Z",
      );
      await billing(
        second,
        "PAID_SUBSCRIPTION_CONFIRMED",
        "2026-09-11T01:00:00Z",
      );
      await billing(first, "SUBSCRIPTION_CANCELLED", "2026-09-09T00:00:00Z");
      await billing(second, "TRIAL_CONVERTED", "2026-09-11T01:00:00Z");
      await billing(second, "PAYMENT_FAILED", "2026-09-11T01:00:00Z");
      await pool.query(
        "INSERT INTO mtm_subscription_history(subscription_id,user_id,source,source_event_id,transitions,status,plan,cancel_at_period_end,recorded_at) VALUES('sub_x',$1,'webhook','evt_x',ARRAY['cancellation_scheduled'],'active','monthly',true,'2026-09-11T02:00:00Z')",
        [second],
      );
      const f = (await snapshot())!;
      const at = (p: string) => f.lifecycle.find((r) => r.period === p)!;
      expect(at("today")).toEqual({
        period: "today",
        newPaidSubscriptions: 1,
        newPaidAccounts: 1,
        returningPaid: 0,
        cancellations: 0,
        conversions: 1,
        scheduledCancellations: { count: 1, complete: true },
      });
      expect(at("week")).toMatchObject({
        newPaidSubscriptions: 2,
        newPaidAccounts: 1,
        returningPaid: 1,
        cancellations: 1,
      });
      expect(at("month").scheduledCancellations.complete).toBe(false);
      expect(at("lifetime")).toMatchObject({
        newPaidSubscriptions: 3,
        newPaidAccounts: 2,
        returningPaid: 1,
        scheduledCancellations: { count: 1, complete: false },
      });
    });

    it("computes account-level paid churn only for a complete covered month", async () => {
      await coverage("subscription_history", "2026-07-15T00:00:00Z");
      const [a1, a2, a3, a4, a5] = await Promise.all(
        [1, 2, 3, 4, 5].map(() => account()),
      );
      const h = (
        sub: string,
        user: string,
        at: string,
        status: string,
        paid: string | null,
      ) =>
        pool.query(
          "INSERT INTO mtm_subscription_history(subscription_id,user_id,source,source_event_id,transitions,status,plan,cancel_at_period_end,paid_until,recorded_at) VALUES($1,$2,'webhook',$3,ARRAY['fixture'],$4,'monthly',false,$5,$6)",
          [sub, user, randomUUID(), status, paid, at],
        );
      const base = "2026-07-15T00:00:00Z";
      await h("s1", a1, base, "active", "2026-08-20");
      await h("s1", a1, "2026-08-20T00:00:05Z", "active", "2026-09-20"); // Renewed: retained.
      await h("s2", a2, base, "active", "2026-08-10"); // Lapsed without renewal: churned.
      await h("s3", a3, base, "active", "2026-08-25");
      await h("s3", a3, "2026-08-26T00:00:00Z", "canceled", "2026-08-25"); // Canceled: churned.
      await h("s4", a4, "2026-08-05T00:00:00Z", "active", "2026-09-05"); // New in month.
      await h("s5", a5, base, "active", "2026-08-15");
      await h("s5", a5, "2026-08-10T00:00:00Z", "canceled", null);
      await h("s6", a5, "2026-08-10T00:00:00Z", "active", "2026-09-10"); // Plan switch: retained.
      const f = (await snapshot())!;
      expect(f.churn).toEqual({
        status: "available",
        monthStart: "2026-08-01T00:00:00.000Z",
        opening: 4,
        churned: 2,
        closing: 3,
        rate: 50,
      });
      await coverage("subscription_history", "2026-08-02T00:00:00Z");
      expect((await snapshot())!.churn).toEqual({
        status: "unavailable",
        firstMeasurableMonth: "2026-09-01T00:00:00.000Z",
        availableFrom: "2026-10-01T00:00:00.000Z",
      });
    });

    it("measures matured trial conversion separately from Phase 1's all-trials rate", async () => {
      await account({
        trial: "converted",
        trialStart: "2026-07-01",
        trialEnd: "2026-07-31",
      });
      await account({
        trial: "expired",
        trialStart: "2026-07-01",
        trialEnd: "2026-07-31",
      });
      await account({
        trial: "active",
        trialStart: "2026-09-01",
        trialEnd: "2026-10-01",
      });
      expect((await snapshot())!.maturedTrials).toEqual({
        matured: 2,
        converted: 1,
        rate: 50,
      });
    });

    it("applies the migration repeatably with one baseline and a fixed coverage start", async () => {
      const p = await schemaPool(["001_subscriptions.sql"]);
      try {
        const id = randomUUID();
        await p.query(
          "INSERT INTO mtm_accounts(id,email,registration,trial_days) VALUES($1,'x@example.invalid','{}',30)",
          [id],
        );
        await p.query(
          "INSERT INTO mtm_subscriptions(stripe_id,user_id,customer_id,plan,status,paid_until) VALUES('sub_existing',$1,'cus_x','monthly','active','2026-10-01')",
          [id],
        );
        await runMigrationSql(p, await migration("002_analytics_ledger.sql"));
        const first = (
          await p.query("SELECT * FROM mtm_analytics_coverage ORDER BY 1")
        ).rows;
        await runMigrationSql(p, await migration("002_analytics_ledger.sql"));
        await runMigrationSql(p, await migration("001_subscriptions.sql"));
        expect(
          (await p.query("SELECT * FROM mtm_analytics_coverage ORDER BY 1"))
            .rows,
        ).toEqual(first);
        expect(
          (
            await p.query(
              "SELECT subscription_id,source,transitions,status FROM mtm_subscription_history",
            )
          ).rows,
        ).toEqual([
          {
            subscription_id: "sub_existing",
            source: "baseline",
            transitions: ["baseline"],
            status: "active",
          },
        ]);
        await expect(
          p.query(
            "INSERT INTO mtm_ledger_entries(entry_key,provider,kind,user_id,provider_customer_id,provider_object_id,amount_minor,currency,status,livemode,provider_occurred_at,occurred_at_source,source) VALUES('k','stripe','payment',$1,'c','o',-1,'gbp','paid',false,now(),'paid_at','webhook')",
            [id],
          ),
        ).rejects.toThrow();
        await expect(
          p.query(
            "INSERT INTO mtm_ledger_entries(entry_key,provider,kind,user_id,provider_customer_id,provider_object_id,amount_minor,currency,status,livemode,provider_occurred_at,occurred_at_source,source) VALUES('k','stripe','payment',$1,'c','o',1,'GBP','paid',false,now(),'paid_at','webhook')",
            [id],
          ),
        ).rejects.toThrow();
      } finally {
        await p.end();
      }
    });
  },
);
