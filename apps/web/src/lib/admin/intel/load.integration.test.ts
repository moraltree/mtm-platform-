import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { Pool, type PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { runMigrationSql } from "../../../../scripts/lib/migrations.mjs";
vi.mock("server-only", () => ({}));
import {
  coverageStarts,
  loadAudience,
  loadCampaigns,
  loadCohorts,
  loadCoverage,
  loadListening,
  loadRevenue,
  loadSubscribers,
} from "./load";
import { recordListeningEvents } from "@/lib/listening/events";
import { testSchemaName } from "../../../../scripts/lib/testSchemas.mjs";

const url = process.env.MTM_ADMIN_TEST_DATABASE_URL;
const migration = (name: string) =>
  readFile(new URL(`../../../../migrations/${name}`, import.meta.url), "utf8");
const MIGRATIONS = [
  "001_subscriptions.sql",
  "002_analytics_ledger.sql",
  "003_analytics_intelligence.sql",
];

describe.skipIf(!url)(
  "Phase 4 intelligence loaders against isolated PostgreSQL tables",
  () => {
    let pool: Pool;
    const schema = testSchemaName("mtm_intel_test_");
    const now = new Date("2026-09-11T12:00:00Z");
    const snap = async <T>(work: (db: PoolClient) => Promise<T>) => {
      const db = await pool.connect();
      try {
        await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
        const r = await work(db);
        await db.query("COMMIT");
        return r;
      } finally {
        db.release();
      }
    };
    const starts = () => snap((db) => coverageStarts(db));
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
      for (const m of MIGRATIONS)
        await runMigrationSql(pool, await migration(m));
    });
    beforeEach(async () => {
      await pool.query(
        "TRUNCATE mtm_accounts,mtm_subscriptions,mtm_billing_events,mtm_webhook_events,mtm_ledger_entries,mtm_ledger_gaps,mtm_subscription_history,mtm_payment_failures,mtm_listening_events,mtm_library CASCADE",
      );
      await pool.query(
        "DELETE FROM mtm_analytics_coverage WHERE dataset='listening'",
      );
      await pool.query(
        "UPDATE mtm_analytics_coverage SET coverage_start='2026-09-01T00:00:00Z'",
      );
    });
    afterAll(async () => {
      if (pool) {
        await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
        await pool.end();
      }
    });
    const account = async (
      created: string,
      extra: {
        campaign?: string | null;
        country?: string | null;
        trialStart?: string;
        trialStatus?: string;
        blocked?: boolean;
      } = {},
    ) => {
      const id = randomUUID();
      await pool.query(
        "INSERT INTO mtm_accounts(id,email,registration,trial_days,trial_status,trial_start,trial_end,blocked,created_at) VALUES($1,$2,$3,30,$4,$5,$6,$7,$8)",
        [
          id,
          `${id}@example.invalid`,
          {
            campaignId: extra.campaign ?? undefined,
            adult: {
              firstName: "SENTINEL_FIRST",
              lastName: "SENTINEL_LAST",
              email: "sentinel@example.invalid",
              country: extra.country ?? undefined,
            },
          },
          extra.trialStatus ?? "offered",
          extra.trialStart ?? null,
          extra.trialStart
            ? new Date(new Date(extra.trialStart).getTime() + 30 * 86_400_000)
            : null,
          extra.blocked ?? false,
          created,
        ],
      );
      return id;
    };
    const event = (user: string, type: string, at: string, objectId = "") =>
      pool.query(
        "INSERT INTO mtm_billing_events(event_key,user_id,type,data,created_at) VALUES($1,$2,$3,$4,$5)",
        [randomUUID(), user, type, { details: { objectId } }, at],
      );
    const sub = (
      id: string,
      user: string,
      extra: { status?: string; paid?: string; scheduled?: boolean } = {},
    ) =>
      pool.query(
        "INSERT INTO mtm_subscriptions(stripe_id,user_id,customer_id,plan,status,paid_until,cancel_at_period_end) VALUES($1,$2,'cus_SENTINEL','monthly',$3,$4,$5)",
        [
          id,
          user,
          extra.status ?? "active",
          extra.paid ?? "2026-10-01",
          extra.scheduled ?? false,
        ],
      );
    const history = (
      subId: string,
      user: string,
      at: string,
      status: string,
      paid: string | null,
      transitions = ["fixture"],
    ) =>
      pool.query(
        "INSERT INTO mtm_subscription_history(subscription_id,user_id,source,source_event_id,transitions,status,plan,cancel_at_period_end,paid_until,recorded_at) VALUES($1,$2,'webhook',$3,$4,$5,'monthly',false,$6,$7)",
        [subId, user, randomUUID(), transitions, status, paid, at],
      );
    const ledger = (
      user: string,
      kind: string,
      amount: number,
      currency: string,
      at: string,
      extra: {
        status?: string;
        plan?: string | null;
        reason?: string | null;
        invoice?: string;
      } = {},
    ) =>
      pool.query(
        `INSERT INTO mtm_ledger_entries(entry_key,provider,kind,user_id,provider_customer_id,provider_invoice_id,provider_object_id,amount_minor,currency,status,plan,livemode,provider_occurred_at,occurred_at_source,source,billing_reason,recorded_at)
         VALUES($1,'stripe',$2,$3,'cus_SENTINEL',$4,$5,$6,$7,$8,$9,false,$10,'paid_at','webhook',$11,'2026-09-01T00:00:00Z')`,
        [
          `k_${randomUUID()}`,
          kind,
          user,
          extra.invoice ?? null,
          extra.invoice ?? `obj_${randomUUID()}`,
          amount,
          currency,
          extra.status ?? (kind === "payment" ? "paid" : "succeeded"),
          extra.plan === undefined ? "monthly" : extra.plan,
          at,
          extra.reason === undefined ? null : extra.reason,
        ],
      );

    it("applies migration 003 repeatably without starting listening coverage", async () => {
      for (const m of MIGRATIONS)
        await runMigrationSql(pool, await migration(m));
      const rows = (
        await pool.query(
          "SELECT dataset FROM mtm_analytics_coverage ORDER BY 1",
        )
      ).rows.map((r) => r.dataset);
      expect(rows).toEqual([
        "billing_reason",
        "payment_failures",
        "payment_ledger",
        "subscription_contracts",
        "subscription_history",
      ]);
      const u = await account("2026-09-01");
      await expect(
        pool.query(
          "INSERT INTO mtm_listening_events(session_id,client_event_seq,event_type,story_id,listener_id,listener_class,occurred_at) VALUES($1,0,'story_started','s1',$2,'vip',now())",
          [randomUUID(), u],
        ),
      ).rejects.toThrow();
      await expect(
        pool.query(
          "INSERT INTO mtm_analytics_coverage(dataset,coverage_start,method) VALUES('made_up',now(),'webhook')",
        ),
      ).rejects.toThrow();
    });

    it("counts subscriber movement in equal windows, including reactivations and net movement", async () => {
      const a = await account("2026-07-01");
      const b = await account("2026-07-01");
      const c = await account("2026-07-01");
      await account("2026-09-05T00:00:00Z", {
        trialStart: "2026-09-06T00:00:00Z",
      }); // Current window.
      await account("2026-09-01T00:00:00Z"); // Previous window [08-28 12:00, 09-04 12:00).
      await account("2026-08-01T00:00:00Z"); // Outside both.
      await account("2026-09-11T12:00:00.001Z"); // After the snapshot.
      await event(a, "PAID_SUBSCRIPTION_CONFIRMED", "2026-08-10T00:00:00Z");
      await event(a, "SUBSCRIPTION_CANCELLED", "2026-08-20T00:00:00Z");
      await event(a, "PAID_SUBSCRIPTION_CONFIRMED", "2026-09-06T00:00:00Z"); // Reactivation.
      await event(b, "PAID_SUBSCRIPTION_CONFIRMED", "2026-09-07T00:00:00Z"); // First-time payer.
      await event(b, "TRIAL_CONVERTED", "2026-09-07T00:00:00Z");
      await event(c, "SUBSCRIPTION_CANCELLED", "2026-09-08T00:00:00Z");
      await event(c, "SUBSCRIPTION_CANCELLED", "2026-09-02T00:00:00Z");
      const d = await account("2026-07-01");
      await event(d, "SUBSCRIPTION_CANCELLED", "2026-09-05T00:00:00Z"); // Out of order: no earlier payment.
      await event(d, "PAID_SUBSCRIPTION_CONFIRMED", "2026-09-06T00:00:00Z"); // First-time payer, not a reactivation.
      await event(c, "PAYMENT_FAILED", "2026-09-09T00:00:00Z");
      await event(c, "PAYMENT_FAILED", "2026-09-09T01:00:00Z");
      const s = await snap(async (db) =>
        loadSubscribers(db, now, "7d", await coverageStarts(db)),
      );
      const cur = Object.fromEntries(
        Object.entries(s.metrics).map(([k, m]) => [k, m.current]),
      );
      expect(cur).toEqual({
        registrations: 1,
        trial_starts: 1,
        conversions: 1,
        new_paid: 3,
        new_paid_accounts: 2,
        reactivations: 1,
        cancellations: 2,
        payments: 0,
        failed_payments: 2,
      });
      expect(s.metrics.registrations.comparison).toMatchObject({
        previous: 1,
        direction: "flat",
      });
      expect(s.metrics.cancellations.comparison?.previous).toBe(1);
      expect(s.netSubscriptions).toEqual({ current: 1, previous: -1 });
      expect(s.metrics.cancellations.comparison?.previous).toBe(1);
      const all = await snap(async (db) =>
        loadSubscribers(db, now, "all", await coverageStarts(db)),
      );
      expect(all.metrics.registrations).toEqual({
        current: 7,
        comparison: null,
      });
      expect(all.netSubscriptions.previous).toBeNull();
      expect(all.history.status).toBe("unavailable");
      expect(all.weekly.registrations).toHaveLength(12);
      expect(all.weekly.registrations.at(-1)).toMatchObject({
        week: "2026-09-07",
        partial: true,
      });
      // Twelve ISO weeks from 22 June reach every registration above.
      expect(all.weekly.registrations.reduce((n, w) => n + w.value, 0)).toBe(7);
    });

    it("compares today with the same time yesterday", async () => {
      await account("2026-09-11T06:00:00Z");
      await account("2026-09-10T06:00:00Z");
      await account("2026-09-10T13:00:00Z"); // Later in the day than now: not comparable.
      const s = await snap(async (db) =>
        loadSubscribers(db, now, "today", await coverageStarts(db)),
      );
      expect(s.metrics.registrations).toEqual({
        current: 1,
        comparison: { current: 1, previous: 1, change: 0, direction: "flat" },
      });
      expect(s.period.compareLabel).toBe("same time yesterday");
    });

    it("measures account-level growth from history only inside coverage, and scheduled cancellations", async () => {
      const a = await account("2026-07-01");
      const b = await account("2026-07-01");
      const c = await account("2026-07-01");
      const blocked = await account("2026-07-01", { blocked: true });
      await history("h1", a, "2026-09-01T00:00:00Z", "active", "2026-09-20");
      await history("h2", b, "2026-09-07T00:00:00Z", "active", "2026-10-07");
      await history("h3", c, "2026-09-01T00:00:00Z", "active", "2026-09-10"); // Lapses.
      await history("h1", a, "2026-09-08T00:00:00Z", "active", "2026-09-20", [
        "cancellation_scheduled",
      ]);
      await sub("s1", a, { scheduled: true });
      await sub("s2", blocked, { scheduled: true });
      await sub("s3", c, { status: "trialing", scheduled: true });
      const s = await snap(async (db) =>
        loadSubscribers(db, now, "7d", await coverageStarts(db)),
      );
      expect(s.history).toEqual({
        status: "available",
        opening: 2,
        closing: 2,
        gained: 1,
        lost: 1,
      });
      expect(s.scheduled).toEqual({ accountsNow: 2, inPeriod: 1 });
      const m = await snap(async (db) =>
        loadSubscribers(db, now, "30d", await coverageStarts(db)),
      );
      expect(m.history).toEqual({
        status: "unavailable",
        historyStart: "2026-09-01T00:00:00.000Z",
      });
      expect(m.scheduled.inPeriod).toBeNull();
    });

    it("reports revenue per calendar window and currency with new/renewal, plans, reversals and failed value", async () => {
      const u = await account("2026-01-01");
      await ledger(u, "payment", 999, "gbp", "2026-09-11T01:00:00Z", {
        reason: "subscription_create",
        invoice: "in_new",
      });
      await ledger(u, "payment", 999, "gbp", "2026-09-08T00:00:00Z", {
        reason: "subscription_cycle",
      });
      await ledger(u, "payment", 9999, "gbp", "2026-08-20T00:00:00Z", {
        plan: "annual",
      });
      await ledger(u, "payment", 500, "gbp", "2026-08-01T00:00:00Z");
      await ledger(u, "payment", 1299, "usd", "2026-01-15T00:00:00Z", {
        reason: "subscription_create",
      });
      await ledger(u, "payment", 1299, "usd", "2025-12-31T23:59:59Z");
      await ledger(u, "refund", 500, "gbp", "2026-09-09T00:00:00Z");
      await ledger(u, "refund", 100, "gbp", "2026-09-09T00:00:00Z", {
        status: "pending",
      });
      await ledger(u, "dispute", 1299, "usd", "2026-09-10T00:00:00Z", {
        status: "lost",
      });
      await pool.query(
        `INSERT INTO mtm_payment_failures(provider_invoice_id,user_id,amount_due_minor,currency,livemode,first_failed_at,last_failed_at,source_event_id,recorded_at) VALUES
         ('in_new',$1,999,'gbp',false,'2026-09-10T00:00:00Z','2026-09-10T00:00:00Z','e1','2026-09-10T00:00:00Z'),
         ('in_f2',$1,1299,'usd',false,'2026-09-10T00:00:00Z','2026-09-10T02:00:00Z','e2','2026-09-10T02:00:00Z')`,
        [u],
      );
      await event(u, "PAYMENT_SUCCEEDED", "2026-08-15T00:00:00Z", "in_old"); // Pre-ledger receipt.
      const r = await snap(async (db) =>
        loadRevenue(db, now, "30d", await coverageStarts(db)),
      );
      const at = (name: string, cur: string) =>
        r.windows
          .find((w) => w.name === name)
          ?.currencies.find((c) => c.currency === cur);
      expect(at("today", "gbp")).toMatchObject({
        grossMinor: 999,
        newMinor: 999,
        netMinor: 999,
        payments: 1,
      });
      expect(at("week", "gbp")).toMatchObject({
        grossMinor: 1998,
        newMinor: 999,
        renewalMinor: 999,
        refundedMinor: 500,
        netMinor: 1498,
      });
      expect(at("month", "usd")).toMatchObject({
        grossMinor: 0,
        disputesLostMinor: 1299,
        netMinor: -1299,
      });
      expect(at("year", "gbp")?.grossMinor).toBe(12497);
      expect(at("year", "usd")?.grossMinor).toBe(1299); // 31 Dec 2025 excluded.
      expect(at("lifetime", "usd")?.grossMinor).toBe(2598);
      expect(at("current", "gbp")).toMatchObject({
        grossMinor: 11997,
        unclassifiedMinor: 9999,
        annualMinor: 9999,
        monthlyMinor: 1998,
      });
      expect(at("previous", "gbp")?.grossMinor).toBe(500);
      const current = r.windows.find((w) => w.name === "current")!;
      expect(current.failures).toEqual([
        {
          currency: "gbp",
          invoices: 1,
          failedMinor: 999,
          recoveredMinor: 999,
          outstandingMinor: 0,
        },
        {
          currency: "usd",
          invoices: 1,
          failedMinor: 1299,
          recoveredMinor: 0,
          outstandingMinor: 1299,
        },
      ]);
      expect(current.coverage.status).toBe("partial");
      expect(current.coverage.reasons[0]).toContain("predate ledger coverage");
      expect(r.windows.find((w) => w.name === "today")?.coverage.status).toBe(
        "complete",
      );
      expect(r.ledgerStart).toBe("2026-09-01T00:00:00.000Z");
      // No window ever mixes currencies.
      for (const w of r.windows)
        expect(new Set(w.currencies.map((c) => c.currency)).size).toBe(
          w.currencies.length,
        );
    });

    it("builds registration and trial cohorts with outcomes to date", async () => {
      const a = await account("2026-08-03", {
        trialStart: "2026-08-03",
        trialStatus: "converted",
      });
      const b = await account("2026-08-20", {
        trialStart: "2026-08-20",
        trialStatus: "active",
      });
      const c = await account("2026-09-02");
      await account("2026-09-05", { blocked: true });
      await event(a, "PAID_SUBSCRIPTION_CONFIRMED", "2026-08-25T00:00:00Z");
      await event(a, "SUBSCRIPTION_CANCELLED", "2026-09-01T00:00:00Z");
      await event(a, "PAID_SUBSCRIPTION_CONFIRMED", "2026-09-05T00:00:00Z");
      await sub("sa", a);
      await event(c, "PAID_SUBSCRIPTION_CONFIRMED", "2026-09-03T00:00:00Z");
      await sub("sc", c, { paid: "2026-09-10" }); // Lapsed: not paying now.
      void b;
      const k = await snap(async (db) =>
        loadCohorts(db, now, await coverageStarts(db)),
      );
      expect(k.registration).toEqual([
        {
          month: "2026-09",
          registered: 2,
          trials: 0,
          converted: 0,
          everPaid: 1,
          payingNow: 0,
          cancelled: 0,
          reactivated: 0,
        },
        {
          month: "2026-08",
          registered: 2,
          trials: 2,
          converted: 1,
          everPaid: 1,
          payingNow: 1,
          cancelled: 1,
          reactivated: 1,
        },
      ]);
      expect(k.trial).toEqual([
        {
          month: "2026-08",
          started: 2,
          matured: 1,
          converted: 1,
          maturedConverted: 1,
        },
      ]);
    });

    it("attributes only validated campaign keys, suppresses small campaigns and keeps currencies apart", async () => {
      const free: string[] = [];
      for (let i = 0; i < 6; i++)
        free.push(
          await account("2026-09-01", {
            campaign: "free30",
            trialStart: "2026-09-01",
          }),
        );
      const zoo1 = await account("2026-09-02", { campaign: "zoo" });
      await account("2026-09-02", { campaign: "zoo" });
      await account("2026-09-02", { campaign: "=HYPERLINK(evil)" });
      await account("2026-09-02");
      await account("2026-07-01", { campaign: "free30" }); // Outside 30 days.
      await event(
        free[0],
        "PAID_SUBSCRIPTION_CONFIRMED",
        "2026-09-05T00:00:00Z",
      );
      await sub("f0", free[0]);
      await ledger(free[0], "payment", 999, "gbp", "2026-09-05T00:00:00Z");
      await ledger(zoo1, "payment", 1299, "usd", "2026-09-05T00:00:00Z");
      const c = await snap((db) => loadCampaigns(db, now, "30d", "free30"));
      expect(c.rows.map((r) => [r.label, r.registrations])).toEqual([
        ["free30", 6],
        ["Smaller campaigns (fewer than 5 registrations each)", 2],
        ["No campaign recorded", 2],
      ]);
      expect(c.suppressed).toBe(1);
      expect(c.rows[0]).toMatchObject({
        trials: 6,
        paid: 1,
        payingNow: 1,
        revenue: [{ currency: "gbp", netMinor: 999 }],
      });
      expect(c.rows[1].revenue).toEqual([{ currency: "usd", netMinor: 1299 }]);
      expect(c.totals.registrations).toBe(10);
      expect(c.selected?.key).toBe("free30");
      expect(
        (await snap((db) => loadCampaigns(db, now, "30d", "zoo"))).selected,
      ).toBeNull();
      expect(
        (await snap((db) => loadCampaigns(db, now, "30d", "=HYPERLINK(evil)")))
          .selected,
      ).toBeNull();
      const json = JSON.stringify(c);
      for (const secret of [
        "SENTINEL",
        "example.invalid",
        "HYPERLINK",
        zoo1,
        "cus_",
      ])
        expect(json).not.toContain(secret);
    });

    it("reports only recognised, self-declared countries with small groups merged", async () => {
      for (let i = 0; i < 4; i++)
        await account("2026-09-01", { country: "GB" });
      await account("2026-09-01", { country: " gb " });
      await account("2026-09-01", { country: "FR" });
      await account("2026-09-01", { country: "XX" });
      await account("2026-09-01", { country: "Brazil" });
      await account("2026-09-01");
      const a = await snap((db) => loadAudience(db, now, "30d"));
      expect(a.rows).toEqual([
        { code: "GB", name: "United Kingdom", registrations: 5, payingNow: 0 },
      ]);
      expect(a.grouped).toEqual({
        registrations: 1,
        payingNow: 0,
        countries: 1,
      });
      expect(a).toMatchObject({ notProvided: 1, unrecognised: 2, total: 9 });
    });

    it("keeps listening awaiting telemetry until coverage exists, then aggregates idempotent events", async () => {
      await pool.query(
        "INSERT INTO mtm_library(id,title,published,free_selection,story_world,season) VALUES('s1','Story One',true,true,'Savannah Seven','1'),('s2','Story Two',true,true,NULL,NULL)",
      );
      expect(
        await snap(async (db) =>
          loadListening(db, now, "7d", await coverageStarts(db)),
        ),
      ).toEqual({
        status: "awaiting",
        storiesWithWorld: 1,
        publishedStories: 2,
      });
      const u = await account("2026-09-01");
      const session = randomUUID();
      const events = [
        {
          sessionId: session,
          seq: 0,
          type: "story_started" as const,
          storyId: "s1",
          occurredAt: "2026-09-10T19:00:00Z",
        },
        {
          sessionId: session,
          seq: 1,
          type: "progress" as const,
          storyId: "s1",
          occurredAt: "2026-09-10T19:10:00Z",
          listenedSeconds: 600,
        },
        {
          sessionId: session,
          seq: 2,
          type: "story_completed" as const,
          storyId: "s1",
          occurredAt: "2026-09-10T19:12:00Z",
          listenedSeconds: 120,
        },
        {
          sessionId: session,
          seq: 3,
          type: "story_started" as const,
          storyId: "s1",
          occurredAt: "2026-09-10T19:13:00Z",
        },
        {
          sessionId: session,
          seq: 4,
          type: "sleep_timer_set" as const,
          storyId: "s1",
          occurredAt: "2026-09-10T19:13:30Z",
        },
      ];
      const db = await pool.connect();
      // The recorder refuses to write unless telemetry is explicitly enabled.
      await expect(
        recordListeningEvents(db, { id: u, listenerClass: "trial" }, events),
      ).rejects.toThrow(/not enabled/);
      vi.stubEnv("LISTENING_TELEMETRY_ENABLED", "true");
      try {
        expect(
          await recordListeningEvents(
            db,
            { id: u, listenerClass: "trial" },
            events,
          ),
        ).toBe(5);
        expect(
          await recordListeningEvents(
            db,
            { id: u, listenerClass: "trial" },
            events,
          ),
        ).toBe(0); // Retry.
        await recordListeningEvents(
          db,
          { id: null, listenerClass: "anonymous" },
          [
            {
              sessionId: randomUUID(),
              seq: 0,
              type: "story_started",
              storyId: "s2",
              occurredAt: "2026-09-10T07:00:00Z",
            },
          ],
        );
      } finally {
        db.release();
        vi.unstubAllEnvs();
      }
      await pool.query(
        "INSERT INTO mtm_analytics_coverage(dataset,coverage_start,method) VALUES('listening','2026-09-10T00:00:00Z','webhook')",
      );
      const l = await snap(async (db) =>
        loadListening(db, now, "7d", await coverageStarts(db)),
      );
      expect(l).toMatchObject({
        status: "available",
        starts: 3,
        completions: 1,
        sessions: 2,
        listenedSeconds: 720,
        sleepTimers: 1,
      });
      if (l.status !== "available") throw new Error("expected available");
      expect(l.stories[0]).toMatchObject({
        storyId: "s1",
        title: "Story One",
        storyWorld: "Savannah Seven",
        starts: 2,
        completions: 1,
        replays: 1,
      });
      expect(l.stories[1]).toMatchObject({
        storyId: "s2",
        storyWorld: "Unassigned",
        replays: 0,
      });
      expect(l.byHour[19]).toBe(720);
      expect(l.byClass.map((c) => c.listenerClass).sort()).toEqual([
        "anonymous",
        "trial",
      ]);
      expect(JSON.stringify(l)).not.toContain(u);
    });

    it("inventories coverage without exposing identifiers", async () => {
      const u = await account("2026-09-01", {
        campaign: "free30",
        country: "GB",
      });
      await ledger(u, "payment", 999, "gbp", "2026-09-05T00:00:00Z");
      const cov = await snap(async (db) =>
        loadCoverage(db, now, await starts()),
      );
      const byId = Object.fromEntries(cov.domains.map((d) => [d.id, d.status]));
      expect(byId).toMatchObject({
        campaigns: "available",
        geography: "partial",
        listening: "unavailable",
        "new-renewal": "partial",
      });
      expect(cov.sandbox).toBe(true);
      expect(JSON.stringify(cov)).not.toContain(u);
    });
  },
);
