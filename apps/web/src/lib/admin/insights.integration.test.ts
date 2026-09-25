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
vi.mock("server-only", () => ({}));
import { readInsights, type Insights } from "./insightsSnapshot";
import { testSchemaName } from "../../../scripts/lib/testSchemas.mjs";

const url = process.env.MTM_ADMIN_TEST_DATABASE_URL;
const migration = (name: string) =>
  readFile(new URL(`../../../migrations/${name}`, import.meta.url), "utf8");

describe.skipIf(!url)(
  "Phase 3 insight aggregates against isolated PostgreSQL tables",
  () => {
    let pool: Pool;
    const schemas: string[] = [];
    const now = new Date("2026-09-11T12:00:00Z");
    const ledgerStart = new Date("2026-09-05T10:00:00Z");
    const schemaPool = async (migrations: string[]) => {
      const schema = testSchemaName("mtm_insights_test_");
      schemas.push(schema);
      const p = new Pool({
        connectionString: url,
        options: `-c search_path=${schema}`,
      });
      await p.query(`CREATE SCHEMA ${schema}`);
      for (const m of migrations) await runMigrationSql(p, await migration(m));
      return p;
    };
    const read = async (
      start: Date | null = ledgerStart,
      p = pool,
    ): Promise<Insights> => {
      const db = await p.connect();
      try {
        await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
        const result = await readInsights(db, now, start);
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
    });
    afterAll(async () => {
      if (pool) await pool.end();
      const admin = new Pool({ connectionString: url });
      for (const schema of schemas)
        await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    });
    const account = async (created: string, trialStart?: string) => {
      const id = randomUUID();
      await pool.query(
        "INSERT INTO mtm_accounts(id,email,registration,trial_days,trial_start,created_at) VALUES($1,$2,$3,30,$4,$5)",
        [
          id,
          `${id}@example.invalid`,
          { secret: "SENTINEL_NOT_FOR_BROWSER" },
          trialStart ?? null,
          created,
        ],
      );
      return id;
    };
    const event = (user: string, type: string, at: string) =>
      pool.query(
        "INSERT INTO mtm_billing_events(event_key,user_id,type,data,created_at) VALUES($1,$2,$3,$4,$5)",
        [randomUUID(), user, type, { secret: "SENTINEL_NOT_FOR_BROWSER" }, at],
      );
    const day = (i: Insights, key: keyof Insights["series"], d: string) =>
      i.series[key].find((p) => p.day === d)?.value;

    it("returns honest zero series, flat comparisons and an empty feed", async () => {
      const i = await read();
      expect(i.series.registrations).toHaveLength(30);
      expect(i.series.registrations.every((p) => p.value === 0)).toBe(true);
      expect(i.comparisons.payments.d30).toEqual({
        current: 0,
        previous: 0,
        change: null,
        direction: "flat",
      });
      expect(i).toMatchObject({
        dataStart: null,
        everPaid: 0,
        webhook: { last24h: 0, last7d: 0 },
        openGaps: 0,
        revenueSeries: [],
        feed: [],
      });
    });

    it("buckets events by UTC date and excludes records after the snapshot", async () => {
      await account("2026-09-10T23:59:59Z");
      await account("2026-09-11T00:00:00Z", "2026-09-11T00:00:00Z");
      await account("2026-09-11T12:00:00.001Z"); // After the snapshot.
      await account("2026-08-12T23:59:59Z"); // Before the 30-day series.
      const u = await account("2026-08-13T00:00:00Z");
      await event(u, "PAYMENT_SUCCEEDED", "2026-09-11T11:00:00Z");
      await event(u, "PAYMENT_FAILED", "2026-09-09T11:00:00Z");
      await event(u, "PAYMENT_FAILED", "2026-09-09T12:00:00Z");
      await event(u, "TRIAL_STARTED", "2026-09-11T11:00:00Z"); // Not a series metric.
      const i = await read();
      expect(i.series.registrations[0].day).toBe("2026-08-13");
      expect(day(i, "registrations", "2026-08-13")).toBe(1);
      expect(day(i, "registrations", "2026-09-10")).toBe(1);
      expect(day(i, "registrations", "2026-09-11")).toBe(1);
      expect(day(i, "trial_starts", "2026-09-11")).toBe(1);
      expect(day(i, "payments", "2026-09-11")).toBe(1);
      expect(day(i, "failed_payments", "2026-09-09")).toBe(2);
      expect(i.series.registrations.reduce((n, p) => n + p.value, 0)).toBe(3);
      expect(i.dataStart).toBe("2026-08-12T23:59:59.000Z");
    });

    it("compares equal rolling windows with exact boundaries", async () => {
      const u = await account("2026-06-01T00:00:00Z");
      const at = (msAgo: number) =>
        new Date(now.getTime() - msAgo).toISOString();
      const DAY = 86_400_000;
      await event(u, "SUBSCRIPTION_CANCELLED", at(0)); // Current 7d (inclusive of now).
      await event(u, "SUBSCRIPTION_CANCELLED", at(7 * DAY - 1)); // Current 7d.
      await event(u, "SUBSCRIPTION_CANCELLED", at(7 * DAY)); // Exactly 7 days: previous 7d.
      await event(u, "SUBSCRIPTION_CANCELLED", at(14 * DAY)); // Exactly 14 days: outside both.
      await event(u, "SUBSCRIPTION_CANCELLED", at(30 * DAY)); // Previous 30d.
      await event(u, "SUBSCRIPTION_CANCELLED", at(60 * DAY)); // Outside.
      await event(u, "SUBSCRIPTION_CANCELLED", at(-1)); // Future.
      const c = (await read()).comparisons.cancellations;
      expect(c.d7).toEqual({
        current: 2,
        previous: 1,
        change: 100,
        direction: "up",
      });
      expect(c.d30).toMatchObject({ current: 4, previous: 1 });
    });

    it("counts distinct ever-paid accounts and webhook recency", async () => {
      const a = await account("2026-07-01T00:00:00Z");
      const b = await account("2026-07-01T00:00:00Z");
      await event(a, "PAID_SUBSCRIPTION_CONFIRMED", "2026-07-02T00:00:00Z");
      await event(a, "PAID_SUBSCRIPTION_CONFIRMED", "2026-08-02T00:00:00Z");
      await event(b, "PAID_SUBSCRIPTION_CONFIRMED", "2026-09-12T00:00:00Z"); // Future.
      for (const [id, at] of [
        ["evt_1", "2026-09-11T11:00:00Z"],
        ["evt_2", "2026-09-06T11:00:00Z"],
        ["evt_3", "2026-08-01T11:00:00Z"],
        ["evt_4", "2026-09-11T12:30:00Z"],
      ])
        await pool.query(
          "INSERT INTO mtm_webhook_events(stripe_event_id,event_type,processed_at) VALUES($1,'invoice.paid',$2)",
          [id, at],
        );
      const i = await read();
      expect(i.everPaid).toBe(1);
      expect(i.webhook).toEqual({ last24h: 1, last7d: 2 });
    });

    it("builds per-currency gross revenue series with coverage and never merges currencies", async () => {
      const u = await account("2026-07-01T00:00:00Z");
      const entry = (amount: number, currency: string, at: string) =>
        pool.query(
          `INSERT INTO mtm_ledger_entries(entry_key,provider,kind,user_id,provider_customer_id,provider_object_id,amount_minor,currency,status,livemode,provider_occurred_at,occurred_at_source,source,recorded_at)
           VALUES($1,'stripe','payment',$2,'cus_SENTINEL',$1,$3,$4,'paid',false,$5,'paid_at','webhook','2026-09-10T00:00:00Z')`,
          [`in_SENTINEL_${randomUUID()}`, u, amount, currency, at],
        );
      await entry(999, "gbp", "2026-09-10T08:00:00Z");
      await entry(999, "gbp", "2026-09-10T20:00:00Z");
      await entry(0, "gbp", "2026-09-10T21:00:00Z");
      await entry(1299, "usd", "2026-09-11T01:00:00Z");
      await pool.query(
        "INSERT INTO mtm_ledger_gaps(gap_key,user_id,kind,provider_object_id,reason,source_event_id,recorded_at) VALUES('g',$1,'payment','in_x','invalid currency','evt','2026-09-10T00:00:00Z')",
        [u],
      );
      const i = await read();
      expect(i.openGaps).toBe(1);
      expect(i.revenueSeries!.map((s) => s.currency)).toEqual(["gbp", "usd"]);
      const gbp = i.revenueSeries![0].days;
      expect(gbp.find((d) => d.day === "2026-09-10")).toEqual({
        day: "2026-09-10",
        grossMinor: 1998,
        payments: 2,
        coverage: "full",
        partial: false,
      });
      expect(gbp.find((d) => d.day === "2026-09-05")?.coverage).toBe("partial");
      expect(gbp.find((d) => d.day === "2026-09-04")?.coverage).toBe("none");
      expect(gbp.at(-1)).toMatchObject({ grossMinor: 0, partial: true });
      expect(i.revenueSeries![1].days.at(-1)?.grossMinor).toBe(1299);
    });

    it("feeds generic labels only, newest first, bounded and without identifiers", async () => {
      const u = await account("2026-09-01T00:00:00Z");
      const types = [
        "TRIAL_STARTED",
        "TRIAL_CONVERTED",
        "PAID_SUBSCRIPTION_CONFIRMED",
        "PAYMENT_SUCCEEDED",
        "PAYMENT_FAILED",
        "SUBSCRIPTION_CANCELLED",
        "REFUND",
        "CHARGEBACK",
        "STRIPE_LIFECYCLE",
        "TRIAL_ACTIVE",
      ];
      for (const [n, type] of types.entries())
        await event(u, type, `2026-09-0${(n % 9) + 1}T12:00:00Z`);
      for (let n = 0; n < 20; n++)
        await event(u, "PAYMENT_SUCCEEDED", "2026-08-01T00:00:00Z");
      const i = await read();
      expect(i.feed).toHaveLength(25);
      expect(new Set(i.feed.map((f) => f.kind))).toEqual(
        new Set([
          "trial_started",
          "conversion",
          "new_paid",
          "payment",
          "payment_failed",
          "cancellation",
          "refund",
          "dispute",
          "registration",
        ]),
      );
      const times = i.feed.map((f) => f.at);
      expect([...times].sort().reverse()).toEqual(times);
      const json = JSON.stringify(i);
      for (const secret of ["SENTINEL", u, "@example.invalid", "in_", "cus_"])
        expect(json).not.toContain(secret);
    });

    it("works on a Phase 1 database without the ledger tables", async () => {
      const phase1 = await schemaPool(["001_subscriptions.sql"]);
      try {
        const i = await read(null, phase1);
        expect(i.openGaps).toBeNull();
        expect(i.revenueSeries).toBeNull();
        expect(i.series.payments).toHaveLength(30);
      } finally {
        await phase1.end();
      }
    });
  },
);
