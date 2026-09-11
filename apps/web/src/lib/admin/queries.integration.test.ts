import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  countsSql,
  statusSql,
  paymentsSql,
  activitySql,
  healthSql,
} from "./queries";
import { utcWindows } from "./policy";
vi.mock("server-only", () => ({}));
const url = process.env.MTM_ADMIN_TEST_DATABASE_URL;
describe.skipIf(!url)(
  "admin aggregates against isolated PostgreSQL tables",
  () => {
    let pool: Pool;
    const schema = `mtm_admin_test_${randomUUID().replaceAll("-", "")}`;
    const now = new Date("2026-09-11T12:00:00Z");
    beforeAll(async () => {
      const parsed = new URL(url!);
      if (
        parsed.hostname !== "127.0.0.1" ||
        parsed.port !== "55439" ||
        parsed.pathname !== "/mtm_subscription_test"
      )
        throw Error("Unsafe database target");
      pool = new Pool({
        connectionString: url,
        options: `-c search_path=${schema}`,
      });
      await pool.query(`CREATE SCHEMA ${schema}`);
      await pool.query(
        await readFile(
          new URL("../../../migrations/001_subscriptions.sql", import.meta.url),
          "utf8",
        ),
      );
    });
    beforeEach(async () => {
      await pool.query(
        "TRUNCATE mtm_accounts,mtm_subscriptions,mtm_billing_events,mtm_webhook_events CASCADE",
      );
    });
    afterAll(async () => {
      if (pool) {
        await pool.query(`DROP SCHEMA ${schema} CASCADE`);
        await pool.end();
      }
    });
    const account = async ({
      blocked = false,
      trial = "offered",
      start = false,
      days = 30,
      end = "2026-10-01",
    } = {}) => {
      const id = randomUUID();
      await pool.query(
        "INSERT INTO mtm_accounts(id,email,registration,trial_days,trial_status,trial_start,trial_end,blocked,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'2026-08-01')",
        [
          id,
          `${id}@example.invalid`,
          { secret: "SENTINEL_NOT_FOR_BROWSER" },
          days,
          trial,
          start ? "2026-08-20" : null,
          end,
          blocked,
        ],
      );
      return id;
    };
    const sub = async (
      id: string,
      status = "active",
      plan = "monthly",
      scheduled = false,
      paid = "2026-10-01",
    ) =>
      pool.query(
        "INSERT INTO mtm_subscriptions(stripe_id,user_id,customer_id,plan,status,paid_until,cancel_at_period_end) VALUES($1,$2,'cus_fixture',$3,$4,$5,$6)",
        [randomUUID(), id, plan, status, paid, scheduled],
      );
    const event = async (id: string, type: string, at: string) =>
      pool.query(
        "INSERT INTO mtm_billing_events(event_key,user_id,type,data,created_at) VALUES($1,$2,$3,$4,$5)",
        [randomUUID(), id, type, { secret: "SENTINEL_NOT_FOR_BROWSER" }, at],
      );
    it("returns honest zero/empty states and validates deduplication constraints", async () => {
      const counts = (await pool.query(countsSql, [now])).rows[0];
      expect(Object.values(counts).every((x) => x === 0)).toBe(true);
      expect((await pool.query(activitySql, [now])).rows).toEqual([]);
      const h = (await pool.query(healthSql, [now])).rows[0];
      expect(h).toMatchObject({
        last_webhook: null,
        receipts: 0,
        failed_payments: 0,
        receipt_key: true,
        billing_key: true,
      });
    });
    it("counts distinct paid accounts, excludes blocked/expired access and separates trial conversions", async () => {
      const paid = await account({ trial: "converted", start: true });
      await sub(paid);
      await sub(paid, "active", "annual");
      const blocked = await account({ blocked: true });
      await sub(blocked);
      await account({ trial: "active", start: true });
      await account({
        trial: "active",
        start: true,
        end: "2026-09-11T12:00:00Z",
      });
      const expired = await account();
      await sub(expired, "active", "monthly", false, "2026-09-11T12:00:00Z");
      const returned = await account({ trial: "converted", start: true });
      await sub(returned, "canceled");
      await sub(returned, "active", "monthly", true);
      await account({ trial: "converted", days: 0 }); // Direct paid purchase does not fabricate a trial conversion.
      const c = (await pool.query(countsSql, [now])).rows[0];
      expect(c).toEqual({
        accounts: 7,
        paid: 2,
        trials: 1,
        canceled_accounts: 1,
        trials_started: 4,
        converted: 2,
        monthly: 2,
        annual: 1,
      });
      expect(JSON.stringify(c)).not.toContain("SENTINEL");
    });
    it("classifies status records into disjoint buckets", async () => {
      const id = await account();
      for (const status of [
        "active",
        "trialing",
        "canceled",
        "past_due",
        "unpaid",
        "paused",
        "incomplete",
        "incomplete_expired",
        "new_unknown_state",
      ])
        await sub(id, status);
      await sub(id, "active", "monthly", true);
      await sub(id, "trialing", "annual", true);
      const rows = (await pool.query(statusSql)).rows;
      expect(rows.find((r) => r.status === "canceling")?.count).toBe(2);
      expect(rows.find((r) => r.status === "active")?.count).toBe(1);
      expect(rows.find((r) => r.status === "other")?.count).toBe(1);
      expect(rows.reduce((n, r) => n + r.count, 0)).toBe(11);
    });
    it("uses inclusive UTC starts and excludes future event receipts", async () => {
      const id = await account();
      for (const at of [
        "2026-08-31T23:59:59Z",
        "2026-09-01T00:00:00Z",
        "2026-09-07T00:00:00Z",
        "2026-09-11T00:00:00Z",
        "2026-09-11T12:00:00Z",
        "2026-09-11T12:00:00.001Z",
      ])
        await event(id, "PAYMENT_SUCCEEDED", at);
      await event(id, "PAYMENT_FAILED", "2026-09-11T01:00:00Z");
      const w = utcWindows(now);
      expect(
        (await pool.query(paymentsSql, [now, w.today, w.week, w.month]))
          .rows[0],
      ).toEqual({ today: 2, week: 3, month: 4, lifetime: 5 });
      expect((await pool.query(healthSql, [now])).rows[0].failed_payments).toBe(
        1,
      );
    });
    it("limits recent activity to safe labels and timestamps in descending order", async () => {
      const id = await account();
      for (let i = 0; i < 25; i++)
        await event(
          id,
          "TRIAL_CONVERTED",
          new Date(now.getTime() - i * 1000).toISOString(),
        );
      const rows = (await pool.query(activitySql, [now])).rows;
      expect(rows).toHaveLength(20);
      expect(Object.keys(rows[0]).sort()).toEqual(["kind", "occurred_at"]);
      expect(rows[0].occurred_at.toISOString()).toBe(now.toISOString());
      expect(JSON.stringify(rows)).not.toContain("SENTINEL");
    });
  },
);
