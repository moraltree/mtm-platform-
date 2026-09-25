import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { readFile } from "node:fs/promises";
import { runMigrationSql } from "../../../scripts/lib/migrations.mjs";
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";

const mocks = vi.hoisted(() => ({
  stripe: {
    subscriptions: {
      retrieve: vi.fn(),
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    checkout: {
      sessions: { create: vi.fn(), retrieve: vi.fn(), expire: vi.fn() },
    },
    customers: { create: vi.fn(), retrieve: vi.fn() },
    prices: { retrieve: vi.fn() },
    billingPortal: { sessions: { create: vi.fn() } },
    setupIntents: { retrieve: vi.fn() },
    charges: { retrieve: vi.fn() },
    invoices: { retrieve: vi.fn() },
    refunds: { list: vi.fn() },
    disputes: { retrieve: vi.fn() },
  },
  cookie: { get: vi.fn(), set: vi.fn() },
}));
vi.mock("./config", async (actual) => ({
  ...(await actual<typeof import("./config")>()),
  billingStripe: () => mocks.stripe,
}));
vi.mock("next/headers", () => ({ cookies: async () => mocks.cookie }));
import { database, transaction, type Account } from "./db";
import { processSubscriptionEvent } from "./webhook";
import { beginTrial, expireTrials } from "./trials";
import { checkout, portal } from "./billing";
import { consumeLogin, hashToken, currentAccount } from "./auth";
import { accessFor } from "./access";

const testUrl = process.env.MTM_TEST_DATABASE_URL;
describe.skipIf(!testUrl)(
  "PostgreSQL subscription integration (isolated test database)",
  () => {
    let userId: string;
    const customer = "cus_fixture";
    const future = Math.floor(Date.now() / 1000) + 86400 * 30;
    const event = (id: string, type = "customer.subscription.updated") =>
      ({
        id,
        type,
        livemode: false,
        created: Math.floor(Date.now() / 1000),
        data: { object: { id: "sub_fixture", customer } },
      }) as unknown as Stripe.Event;
    const subscription = (status = "active", paid = true) => ({
      id: "sub_fixture",
      customer,
      livemode: false,
      status,
      metadata: { userId, mtm: "subscriptions-v1" },
      items: {
        data: [
          {
            id: "si_fixture",
            quantity: 1,
            price: { id: "price_monthly" },
            current_period_start: future - 86400 * 30,
            current_period_end: future,
          },
        ],
      },
      latest_invoice: {
        id: "in_fixture",
        status: paid ? "paid" : "open",
        amount_paid: paid ? 999 : 0,
        livemode: false,
      },
      cancel_at_period_end: false,
    });
    const paidInvoice = (id = "in_fixture", extra = {}) => ({
      id,
      object: "invoice",
      livemode: false,
      customer,
      status: "paid",
      amount_paid: 999,
      amount_due: 999,
      billing_reason: "subscription_create",
      currency: "gbp",
      status_transitions: { paid_at: future - 86400 * 30 },
      parent: { subscription_details: { subscription: "sub_fixture" } },
      lines: {
        has_more: false,
        data: [{ pricing: { price_details: { price: "price_monthly" } } }],
      },
      payments: {
        data: [{ status: "paid", payment: { payment_intent: "pi_fixture" } }],
      },
      ...extra,
    });
    const account = async () =>
      (
        await database().query<Account>(
          "SELECT * FROM mtm_accounts WHERE id=$1",
          [userId],
        )
      ).rows[0];
    beforeAll(async () => {
      // Destructive fixture resets are permitted only on an explicitly named, dedicated local test DB.
      const url = new URL(testUrl!);
      if (
        !["localhost", "127.0.0.1"].includes(url.hostname) ||
        url.port !== "55439" ||
        url.pathname !== "/mtm_subscription_test"
      )
        throw new Error("Unsafe test database target");
      process.env.SUBSCRIPTIONS_ENABLED = "true";
      process.env.SUBSCRIPTIONS_DATABASE_URL = testUrl;
      process.env.STRIPE_PRICE_MONTHLY = "price_monthly";
      process.env.STRIPE_PRICE_ANNUAL = "price_annual";
      for (const migration of [
        "001_subscriptions.sql",
        "002_analytics_ledger.sql",
        "003_analytics_intelligence.sql",
      ])
        await runMigrationSql(
          database(),
          await readFile(
            new URL(`../../../migrations/${migration}`, import.meta.url),
            "utf8",
          ),
        );
    });
    beforeEach(async () => {
      vi.clearAllMocks();
      await database().query(
        "TRUNCATE mtm_accounts,mtm_login_tokens,mtm_sessions,mtm_subscriptions,mtm_checkout_attempts,mtm_webhook_events,mtm_billing_events,mtm_library,mtm_ledger_entries,mtm_ledger_gaps,mtm_subscription_history,mtm_payment_failures CASCADE",
      );
      await database().query(
        "INSERT INTO mtm_library(id,title,published,free_selection) SELECT 'story-'||n,'Story '||n,true,true FROM generate_series(1,30) n",
      );
      userId = randomUUID();
      await database().query(
        "INSERT INTO mtm_accounts(id,email,registration,customer_id,trial_days) VALUES($1,'parent@example.test',$2,$3,30)",
        [
          userId,
          JSON.stringify({
            campaignId: "campaign-fixture",
            acquisitionSource: "qr",
          }),
          customer,
        ],
      );
      mocks.stripe.subscriptions.retrieve.mockResolvedValue(subscription());
      mocks.stripe.subscriptions.list.mockResolvedValue({
        data: [],
        has_more: false,
      });
      mocks.stripe.invoices.retrieve.mockImplementation(async (id) =>
        paidInvoice(id),
      );
      mocks.stripe.refunds.list.mockResolvedValue({
        data: [],
        has_more: false,
      });
      mocks.stripe.prices.retrieve.mockImplementation(async (id) => ({
        id,
        active: true,
        livemode: false,
        type: "recurring",
        currency: "gbp",
        unit_amount: 999,
        recurring: {
          interval: id === "price_monthly" ? "month" : "year",
          interval_count: 1,
          usage_type: "licensed",
        },
      }));
    });
    afterAll(async () => {
      await database().end();
    });
    it("deduplicates concurrent webhook delivery and paid conversions", async () => {
      await Promise.all([
        processSubscriptionEvent(event("evt_one")),
        processSubscriptionEvent(event("evt_one")),
      ]);
      expect(
        (await database().query("SELECT * FROM mtm_subscriptions")).rowCount,
      ).toBe(1);
      expect(
        (
          await database().query(
            "SELECT * FROM mtm_billing_events WHERE type='PAID_SUBSCRIPTION_CONFIRMED'",
          )
        ).rowCount,
      ).toBe(1);
      expect(await accessFor(userId)).toBe("paid");
    });
    it("retrieves current state when stale events arrive after cancellation", async () => {
      await processSubscriptionEvent(event("evt_active"));
      mocks.stripe.subscriptions.retrieve.mockResolvedValue(
        subscription("canceled"),
      );
      await processSubscriptionEvent(event("evt_old"));
      expect(await accessFor(userId)).toBe("none");
    });
    it("rolls back the receipt on failure so Stripe can retry safely", async () => {
      mocks.stripe.subscriptions.retrieve.mockRejectedValueOnce(
        new Error("temporary network failure"),
      );
      await expect(
        processSubscriptionEvent(event("evt_retry")),
      ).rejects.toThrow();
      expect(
        (await database().query("SELECT * FROM mtm_webhook_events")).rowCount,
      ).toBe(0);
      await processSubscriptionEvent(event("evt_retry"));
      expect(await accessFor(userId)).toBe("paid");
    });
    it("never counts a zero-value trial invoice as a paid conversion", async () => {
      mocks.stripe.subscriptions.retrieve.mockResolvedValue(
        subscription("trialing", false),
      );
      await processSubscriptionEvent(event("evt_trial"));
      expect(
        (
          await database().query(
            "SELECT * FROM mtm_billing_events WHERE type='PAID_SUBSCRIPTION_CONFIRMED'",
          )
        ).rowCount,
      ).toBe(0);
      expect(await accessFor(userId)).toBe("none");
    });
    it("starts one trial, allows replays, converts immediately and never restarts it", async () => {
      await transaction(async (db) => beginTrial(db, await account()));
      const original = (await account()).trial_end;
      expect(await accessFor(userId)).toBe("trial");
      expect(await accessFor(userId)).toBe("trial");
      await processSubscriptionEvent(event("evt_paid"));
      expect(await accessFor(userId)).toBe("paid");
      await transaction(async (db) => beginTrial(db, await account()));
      expect((await account()).trial_end).toEqual(original);
      expect(
        (
          await database().query(
            "SELECT * FROM mtm_billing_events WHERE type='TRIAL_CONVERTED'",
          )
        ).rowCount,
      ).toBe(1);
    });
    it("expires trials exactly once and refuses to start an undersized selection", async () => {
      await database().query("DELETE FROM mtm_library WHERE id='story-30'");
      await expect(
        transaction(async (db) => beginTrial(db, await account())),
      ).rejects.toThrow("30");
      await database().query(
        "UPDATE mtm_accounts SET trial_status='active',trial_end=now()-interval '1 second' WHERE id=$1",
        [userId],
      );
      await expireTrials();
      await expireTrials();
      expect(await accessFor(userId)).toBe("none");
      expect(
        (
          await database().query(
            "SELECT * FROM mtm_billing_events WHERE type='TRIAL_EXPIRED'",
          )
        ).rowCount,
      ).toBe(1);
    });
    it("rejects cross-account Stripe linkage and leaves receipt retryable", async () => {
      mocks.stripe.subscriptions.retrieve.mockResolvedValue({
        ...subscription(),
        metadata: { userId: randomUUID(), mtm: "subscriptions-v1" },
      });
      await expect(
        processSubscriptionEvent(event("evt_mismatch")),
      ).rejects.toThrow("linkage");
      expect(
        (await database().query("SELECT * FROM mtm_webhook_events")).rowCount,
      ).toBe(0);
    });
    it("creates subscription checkout from server price mapping and reuses the operation", async () => {
      mocks.stripe.checkout.sessions.create.mockResolvedValue({
        id: "cs_fixture",
        url: "https://checkout.stripe.com/fixture",
        livemode: false,
      });
      mocks.stripe.checkout.sessions.retrieve.mockResolvedValue({
        status: "open",
        url: "https://checkout.stripe.com/fixture",
      });
      await expect(
        checkout(userId, "price_attacker", "paid"),
      ).rejects.toThrow();
      await checkout(userId, "monthly", "paid");
      await checkout(userId, "monthly", "paid");
      expect(mocks.stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
      expect(
        mocks.stripe.checkout.sessions.create.mock.calls[0][0],
      ).toMatchObject({
        mode: "subscription",
        customer,
        line_items: [{ price: "price_monthly", quantity: 1 }],
        metadata: { campaignId: "campaign-fixture", source: "qr" },
      });
    });
    it("does not open another subscription while one is active", async () => {
      mocks.stripe.subscriptions.list.mockResolvedValue({
        data: [subscription()],
      });
      await expect(checkout(userId, "monthly", "paid")).rejects.toThrow(
        "existing subscription",
      );
      expect(mocks.stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });
    it("uses stored ownership for portal sessions", async () => {
      mocks.stripe.customers.retrieve.mockResolvedValue({
        id: customer,
        livemode: false,
        metadata: { userId },
      });
      mocks.stripe.billingPortal.sessions.create.mockResolvedValue({
        url: "https://billing.stripe.com/fixture",
      });
      await portal(userId);
      expect(
        mocks.stripe.billingPortal.sessions.create.mock.calls[0][0].customer,
      ).toBe(customer);
      mocks.stripe.customers.retrieve.mockResolvedValue({
        id: customer,
        livemode: false,
        metadata: { userId: "other" },
      });
      await expect(portal(userId)).rejects.toThrow("linkage");
    });
    it("cannot start a deferred free trial after paying directly", async () => {
      await database().query(
        "UPDATE mtm_accounts SET card_required=true WHERE id=$1",
        [userId],
      );
      await processSubscriptionEvent(event("evt_direct_paid"));
      expect((await account()).trial_status).toBe("converted");
      await transaction(async (db) => beginTrial(db, await account()));
      expect((await account()).trial_start).toBeNull();
      expect(
        (
          await database().query(
            "SELECT * FROM mtm_billing_events WHERE type='TRIAL_CONVERTED'",
          )
        ).rowCount,
      ).toBe(0);
    });
    it("consumes email verification once and stores only a hashed session", async () => {
      const token = "a".repeat(64);
      await database().query(
        "INSERT INTO mtm_login_tokens(token_hash,email,expires_at) VALUES($1,'parent@example.test',now()+interval '1 minute')",
        [hashToken(token)],
      );
      await consumeLogin(token);
      await expect(consumeLogin(token)).rejects.toThrow("already used");
      const session = mocks.cookie.set.mock.calls[0][1];
      expect(
        (await database().query("SELECT token_hash FROM mtm_sessions")).rows[0]
          .token_hash,
      ).toBe(hashToken(session));
      mocks.cookie.get.mockReturnValue({ value: session });
      expect((await currentAccount())?.id).toBe(userId);
      mocks.cookie.get.mockReturnValue({ value: "forged-session" });
      expect(await currentAccount()).toBeNull();
    });
    it("revokes failed payments and recovers without repeating conversion", async () => {
      await processSubscriptionEvent(event("evt_paid_initial"));
      mocks.stripe.subscriptions.retrieve.mockResolvedValue(
        subscription("past_due", false),
      );
      const failed = {
        ...event("evt_failure", "invoice.payment_failed"),
        data: {
          object: {
            id: "in_failed",
            customer,
            parent: { subscription_details: { subscription: "sub_fixture" } },
          },
        },
      } as unknown as Stripe.Event;
      await processSubscriptionEvent(failed);
      expect(await accessFor(userId)).toBe("none");
      expect(
        (
          await database().query(
            "SELECT * FROM mtm_billing_events WHERE type='PAYMENT_FAILED'",
          )
        ).rowCount,
      ).toBe(1);
      mocks.stripe.subscriptions.retrieve.mockResolvedValue(subscription());
      await processSubscriptionEvent({
        ...failed,
        id: "evt_recovered",
        type: "invoice.paid",
      } as Stripe.Event);
      expect(await accessFor(userId)).toBe("paid");
      expect(
        (
          await database().query(
            "SELECT * FROM mtm_billing_events WHERE type='PAID_SUBSCRIPTION_CONFIRMED'",
          )
        ).rowCount,
      ).toBe(1);
    });
    it("retains scheduled-cancellation access only until the paid boundary", async () => {
      mocks.stripe.subscriptions.retrieve.mockResolvedValue({
        ...subscription(),
        cancel_at_period_end: true,
      });
      await processSubscriptionEvent(event("evt_scheduled_cancel"));
      expect(await accessFor(userId)).toBe("paid");
      await database().query(
        "UPDATE mtm_subscriptions SET paid_until=now()-interval '1 second'",
      );
      expect(await accessFor(userId)).toBe("none");
    });
    it("records refunds and blocks disputed accounts idempotently", async () => {
      await processSubscriptionEvent(event("evt_paid_refund"));
      await processSubscriptionEvent(event("evt_refund", "charge.refunded"));
      expect(
        (
          await database().query(
            "SELECT * FROM mtm_billing_events WHERE type='REFUND'",
          )
        ).rowCount,
      ).toBe(1);
      mocks.stripe.charges.retrieve.mockResolvedValue({ customer });
      const dispute = {
        ...event("evt_dispute", "charge.dispute.created"),
        data: { object: { id: "dp_fixture", charge: "ch_fixture" } },
      } as unknown as Stripe.Event;
      await processSubscriptionEvent(dispute);
      await processSubscriptionEvent(dispute);
      expect(await accessFor(userId)).toBe("none");
      expect(
        (
          await database().query(
            "SELECT * FROM mtm_billing_events WHERE type='CHARGEBACK'",
          )
        ).rowCount,
      ).toBe(1);
    });
    it("mirrors one absolute deadline for an automatic card-required trial", async () => {
      await database().query(
        "UPDATE mtm_accounts SET card_required=true,auto_convert=true WHERE id=$1",
        [userId],
      );
      mocks.stripe.checkout.sessions.retrieve.mockResolvedValue({
        id: "cs_setup",
        status: "complete",
        customer,
        mode: "setup",
        client_reference_id: userId,
        setup_intent: "seti_fixture",
        metadata: { mtm: "subscriptions-v1", userId, plan: "monthly" },
      });
      mocks.stripe.setupIntents.retrieve.mockResolvedValue({
        status: "succeeded",
        customer,
        payment_method: "pm_fixture",
      });
      mocks.stripe.subscriptions.create.mockResolvedValue({
        id: "sub_fixture",
      });
      mocks.stripe.subscriptions.retrieve.mockResolvedValue(
        subscription("trialing", false),
      );
      const setupEvent = {
        ...event("evt_setup", "checkout.session.completed"),
        data: { object: { id: "cs_setup", customer } },
      } as unknown as Stripe.Event;
      await processSubscriptionEvent(setupEvent);
      const firstEnd = (await account()).trial_end;
      await processSubscriptionEvent(setupEvent);
      expect(mocks.stripe.subscriptions.create).toHaveBeenCalledTimes(1);
      expect(mocks.stripe.subscriptions.create.mock.calls[0][0].trial_end).toBe(
        Math.floor(firstEnd!.getTime() / 1000),
      );
      expect(await accessFor(userId)).toBe("trial");
      expect(
        (
          await database().query(
            "SELECT * FROM mtm_billing_events WHERE type='PAID_SUBSCRIPTION_CONFIRMED'",
          )
        ).rowCount,
      ).toBe(0);
    });
    it("converts before trial expiry using an immediate hosted invoice", async () => {
      mocks.stripe.subscriptions.list.mockResolvedValue({
        data: [subscription("trialing", false)],
      });
      mocks.stripe.subscriptions.update.mockResolvedValue({
        latest_invoice: {
          hosted_invoice_url: "https://invoice.stripe.com/fixture",
        },
      });
      expect(await checkout(userId, "annual", "paid")).toBe(
        "https://invoice.stripe.com/fixture",
      );
      expect(mocks.stripe.subscriptions.update.mock.calls[0][1]).toMatchObject({
        trial_end: "now",
        items: [{ id: "si_fixture", price: "price_annual" }],
      });
      expect(mocks.stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });
    const invoiceEvent = (id: string, invoice: string, type = "invoice.paid") =>
      ({
        ...event(id, type),
        data: {
          object: {
            id: invoice,
            customer,
            parent: { subscription_details: { subscription: "sub_fixture" } },
          },
        },
      }) as unknown as Stripe.Event;
    const ledger = async () =>
      (
        await database().query(
          "SELECT * FROM mtm_ledger_entries ORDER BY entry_key",
        )
      ).rows;
    it("records one ledger payment across invoice.paid, payment_succeeded and concurrent redelivery", async () => {
      await Promise.all([
        processSubscriptionEvent(invoiceEvent("evt_inv_paid", "in_one")),
        processSubscriptionEvent(invoiceEvent("evt_inv_paid", "in_one")),
      ]);
      await processSubscriptionEvent(
        invoiceEvent("evt_inv_ok", "in_one", "invoice.payment_succeeded"),
      );
      const rows = await ledger();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        entry_key: "stripe:invoice:in_one",
        kind: "payment",
        user_id: userId,
        provider_customer_id: customer,
        provider_subscription_id: "sub_fixture",
        provider_payment_intent_id: "pi_fixture",
        amount_minor: "999",
        currency: "gbp",
        plan: "monthly",
        livemode: false,
        occurred_at_source: "paid_at",
        source: "webhook",
        source_event_id: "evt_inv_paid",
      });
      expect(rows[0].provider_occurred_at.getTime()).toBe(
        (future - 86400 * 30) * 1000,
      );
      expect(
        (
          await database().query(
            "SELECT * FROM mtm_billing_events WHERE type='PAYMENT_SUCCEEDED'",
          )
        ).rowCount,
      ).toBe(1);
    });
    it("records malformed or unverifiable invoices as gaps without blocking entitlement", async () => {
      mocks.stripe.invoices.retrieve.mockResolvedValueOnce(
        paidInvoice("in_bad", { currency: null }),
      );
      await processSubscriptionEvent(invoiceEvent("evt_bad", "in_bad"));
      mocks.stripe.invoices.retrieve.mockResolvedValueOnce(
        paidInvoice("in_live", { livemode: true }),
      );
      await processSubscriptionEvent(invoiceEvent("evt_live", "in_live"));
      mocks.stripe.invoices.retrieve.mockResolvedValueOnce(
        paidInvoice("in_other", { customer: "cus_other" }),
      );
      await processSubscriptionEvent(invoiceEvent("evt_other", "in_other"));
      expect(await ledger()).toEqual([]);
      const gaps = (
        await database().query(
          "SELECT reason FROM mtm_ledger_gaps ORDER BY reason",
        )
      ).rows.map((r) => r.reason);
      expect(gaps).toEqual([
        "customer mismatch",
        "invalid currency",
        "not a test-mode invoice",
      ]);
      expect(await accessFor(userId)).toBe("paid");
    });
    it("rolls back the ledger with the receipt when invoice retrieval fails", async () => {
      mocks.stripe.invoices.retrieve.mockRejectedValueOnce(
        new Error("temporary network failure"),
      );
      await expect(
        processSubscriptionEvent(invoiceEvent("evt_inv_retry", "in_retry")),
      ).rejects.toThrow();
      expect(await ledger()).toEqual([]);
      expect(
        (await database().query("SELECT * FROM mtm_webhook_events")).rowCount,
      ).toBe(0);
      await processSubscriptionEvent(invoiceEvent("evt_inv_retry", "in_retry"));
      expect(await ledger()).toHaveLength(1);
    });
    it("attributes annual invoices and leaves mixed-price invoices unattributed", async () => {
      mocks.stripe.invoices.retrieve.mockResolvedValueOnce(
        paidInvoice("in_annual", {
          lines: {
            has_more: false,
            data: [{ pricing: { price_details: { price: "price_annual" } } }],
          },
        }),
      );
      await processSubscriptionEvent(invoiceEvent("evt_annual", "in_annual"));
      mocks.stripe.invoices.retrieve.mockResolvedValueOnce(
        paidInvoice("in_mixed", {
          lines: {
            has_more: false,
            data: [
              { pricing: { price_details: { price: "price_monthly" } } },
              { pricing: { price_details: { price: "price_annual" } } },
            ],
          },
        }),
      );
      await processSubscriptionEvent(invoiceEvent("evt_mixed", "in_mixed"));
      const plans = Object.fromEntries(
        (await ledger()).map((r) => [r.provider_object_id, r.plan]),
      );
      expect(plans).toEqual({ in_annual: "annual", in_mixed: null });
    });
    it("records refunds idempotently, progresses their status and inherits plan from the payment", async () => {
      await processSubscriptionEvent(invoiceEvent("evt_pay", "in_one"));
      mocks.stripe.charges.retrieve.mockResolvedValue({
        id: "ch_fixture",
        customer,
        livemode: false,
      });
      const refund = (status: string) => ({
        id: "re_fixture",
        amount: 500,
        currency: "gbp",
        status,
        created: future - 86400,
        charge: "ch_fixture",
        payment_intent: "pi_fixture",
      });
      mocks.stripe.refunds.list.mockResolvedValueOnce({
        data: [refund("pending")],
        has_more: false,
      });
      const refunded = {
        ...event("evt_refund_1", "charge.refunded"),
        data: { object: { id: "ch_fixture", customer } },
      } as unknown as Stripe.Event;
      await processSubscriptionEvent(refunded);
      mocks.stripe.refunds.list.mockResolvedValue({
        data: [refund("succeeded")],
        has_more: false,
      });
      await processSubscriptionEvent({
        ...refunded,
        id: "evt_refund_2",
      } as Stripe.Event);
      await processSubscriptionEvent({
        ...refunded,
        id: "evt_refund_2",
      } as Stripe.Event);
      const rows = (await ledger()).filter((r) => r.kind === "refund");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        amount_minor: "500",
        status: "succeeded",
        plan: "monthly",
        provider_invoice_id: "in_one",
        occurred_at_source: "object_created",
      });
    });
    it("records an unverified refund charge as a gap", async () => {
      mocks.stripe.charges.retrieve.mockResolvedValue({
        id: "ch_fixture",
        customer: "cus_other",
        livemode: false,
      });
      await processSubscriptionEvent({
        ...event("evt_refund_bad", "charge.refunded"),
        data: { object: { id: "ch_fixture", customer } },
      } as unknown as Stripe.Event);
      expect(await ledger()).toEqual([]);
      expect(mocks.stripe.refunds.list).not.toHaveBeenCalled();
      expect(
        (await database().query("SELECT reason FROM mtm_ledger_gaps")).rows,
      ).toEqual([{ reason: "refund charge not verified" }]);
    });
    it("tracks one dispute row whose status follows the retrieved dispute", async () => {
      mocks.stripe.charges.retrieve.mockResolvedValue({ customer });
      const dispute = (status: string) => ({
        id: "dp_fixture",
        amount: 999,
        currency: "gbp",
        status,
        created: future - 3600,
        livemode: false,
        charge: "ch_fixture",
        payment_intent: "pi_fixture",
      });
      mocks.stripe.disputes.retrieve.mockResolvedValueOnce(
        dispute("needs_response"),
      );
      const opened = {
        ...event("evt_dp_open", "charge.dispute.created"),
        data: { object: { id: "dp_fixture", charge: "ch_fixture" } },
      } as unknown as Stripe.Event;
      await processSubscriptionEvent(opened);
      mocks.stripe.disputes.retrieve.mockResolvedValueOnce(dispute("lost"));
      await processSubscriptionEvent({
        ...opened,
        id: "evt_dp_closed",
        type: "charge.dispute.closed",
      } as Stripe.Event);
      const rows = await ledger();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ kind: "dispute", status: "lost" });
    });
    it("captures contract snapshots and appends only real subscription transitions", async () => {
      const priced = (extra = {}) => ({
        ...subscription(),
        items: {
          data: [
            {
              ...subscription().items.data[0],
              discounts: [],
              price: {
                id: "price_monthly",
                unit_amount: 999,
                currency: "GBP",
                billing_scheme: "per_unit",
                recurring: {
                  interval: "month",
                  interval_count: 1,
                  usage_type: "licensed",
                },
              },
            },
          ],
        },
        discounts: [],
        ...extra,
      });
      mocks.stripe.subscriptions.retrieve.mockResolvedValue(priced());
      await processSubscriptionEvent(event("evt_h1"));
      await processSubscriptionEvent(event("evt_h2")); // No state change.
      mocks.stripe.subscriptions.retrieve.mockResolvedValue(
        priced({ cancel_at_period_end: true }),
      );
      await processSubscriptionEvent(event("evt_h3"));
      await processSubscriptionEvent(event("evt_h3")); // Redelivery.
      mocks.stripe.subscriptions.retrieve.mockResolvedValue(
        priced({ status: "canceled" }),
      );
      await processSubscriptionEvent(
        event("evt_h4", "customer.subscription.deleted"),
      );
      const history = (
        await database().query(
          "SELECT source_event_id,transitions,prev_status,status FROM mtm_subscription_history ORDER BY id",
        )
      ).rows;
      expect(history).toEqual([
        {
          source_event_id: "evt_h1",
          transitions: ["created"],
          prev_status: null,
          status: "active",
        },
        {
          source_event_id: "evt_h3",
          transitions: ["cancellation_scheduled"],
          prev_status: "active",
          status: "active",
        },
        {
          source_event_id: "evt_h4",
          transitions: [
            "status_changed",
            "canceled",
            "cancellation_unscheduled",
          ],
          prev_status: "active",
          status: "canceled",
        },
      ]);
      const contract = (
        await database().query(
          "SELECT unit_amount_minor,currency,billing_interval,interval_count,quantity,discounted,contract_recorded_at FROM mtm_subscriptions",
        )
      ).rows[0];
      expect(contract).toMatchObject({
        unit_amount_minor: "999",
        currency: "gbp",
        billing_interval: "month",
        interval_count: 1,
        quantity: 1,
        discounted: false,
      });
      expect(contract.contract_recorded_at).toBeInstanceOf(Date);
    });
    it("stores no contract amount for pricing shapes it cannot normalise", async () => {
      await processSubscriptionEvent(event("evt_unpriced"));
      expect(
        (
          await database().query(
            "SELECT unit_amount_minor,contract_recorded_at,price_id FROM mtm_subscriptions",
          )
        ).rows[0],
      ).toEqual({
        unit_amount_minor: null,
        contract_recorded_at: null,
        price_id: "price_monthly",
      });
    });
    it("classifies new versus renewal payments from the retrieved invoice", async () => {
      await processSubscriptionEvent(invoiceEvent("evt_new", "in_new"));
      mocks.stripe.invoices.retrieve.mockResolvedValueOnce(
        paidInvoice("in_renew", { billing_reason: "subscription_cycle" }),
      );
      await processSubscriptionEvent(invoiceEvent("evt_renew", "in_renew"));
      mocks.stripe.invoices.retrieve.mockResolvedValueOnce(
        paidInvoice("in_odd", { billing_reason: "DROP TABLE" }),
      );
      await processSubscriptionEvent(invoiceEvent("evt_odd", "in_odd"));
      const reasons = Object.fromEntries(
        (await ledger()).map((r) => [r.provider_object_id, r.billing_reason]),
      );
      expect(reasons).toEqual({
        in_new: "subscription_create",
        in_renew: "subscription_cycle",
        in_odd: null,
      });
    });
    it("records failed invoice value once per invoice and counts each failed attempt", async () => {
      const failed = (id: string, extra = {}) => {
        mocks.stripe.invoices.retrieve.mockResolvedValueOnce(
          paidInvoice("in_fail", {
            status: "open",
            amount_paid: 0,
            amount_due: 1299,
            ...extra,
          }),
        );
        return processSubscriptionEvent(
          invoiceEvent(id, "in_fail", "invoice.payment_failed"),
        );
      };
      await failed("evt_fail_1");
      await failed("evt_fail_2");
      await processSubscriptionEvent(
        invoiceEvent("evt_fail_2", "in_fail", "invoice.payment_failed"),
      ); // Redelivery: receipt dedupe prevents a third attempt.
      const rows = (
        await database().query("SELECT * FROM mtm_payment_failures")
      ).rows;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        provider_invoice_id: "in_fail",
        amount_due_minor: "1299",
        currency: "gbp",
        attempts: 2,
        livemode: false,
      });
      mocks.stripe.invoices.retrieve.mockResolvedValueOnce(
        paidInvoice("in_fail_live", { livemode: true, amount_due: 5 }),
      );
      await processSubscriptionEvent(
        invoiceEvent("evt_fail_live", "in_fail_live", "invoice.payment_failed"),
      );
      expect(
        (await database().query("SELECT * FROM mtm_payment_failures")).rowCount,
      ).toBe(1);
      expect(
        (
          await database().query(
            "SELECT reason FROM mtm_ledger_gaps WHERE provider_object_id='in_fail_live'",
          )
        ).rows,
      ).toEqual([{ reason: "not a test-mode invoice" }]);
    });
  },
);
