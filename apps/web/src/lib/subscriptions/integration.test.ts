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
      await database().query(
        await readFile(
          new URL("../../../migrations/001_subscriptions.sql", import.meta.url),
          "utf8",
        ),
      );
    });
    beforeEach(async () => {
      vi.clearAllMocks();
      await database().query(
        "TRUNCATE mtm_accounts,mtm_login_tokens,mtm_sessions,mtm_subscriptions,mtm_checkout_attempts,mtm_webhook_events,mtm_billing_events,mtm_library CASCADE",
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
  },
);
