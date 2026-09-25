import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  classifyTransition,
  disputeEntry,
  invoicePaymentEntry,
  invoicePlan,
  refundEntry,
} from "./ledger";

const planFor = (price: string) =>
  price === "price_m" ? "monthly" : price === "price_a" ? "annual" : null;
const line = (price: string | { id: string }) => ({
  pricing: { price_details: { price } },
});
const invoice = (extra: Record<string, unknown> = {}) =>
  ({
    id: "in_1",
    livemode: false,
    customer: "cus_1",
    status: "paid",
    amount_paid: 1299,
    currency: "EUR",
    status_transitions: { paid_at: 1_790_000_000 },
    parent: { subscription_details: { subscription: { id: "sub_1" } } },
    lines: { has_more: false, data: [line("price_m")] },
    payments: {
      data: [
        { status: "canceled", payment: { payment_intent: "pi_old" } },
        { status: "paid", payment: { payment_intent: "pi_1", charge: "ch_1" } },
      ],
    },
    ...extra,
  }) as unknown as Stripe.Invoice;

describe("ledger extraction", () => {
  it("records a verified paid invoice with provider time, currency and plan", () => {
    const result = invoicePaymentEntry(invoice(), "cus_1", planFor, 1);
    expect(result).toEqual({
      entry: expect.objectContaining({
        entryKey: "stripe:invoice:in_1",
        amountMinor: 1299,
        currency: "eur",
        plan: "monthly",
        priceId: "price_m",
        subscriptionId: "sub_1",
        paymentIntentId: "pi_1",
        chargeId: "ch_1",
        occurredAt: new Date(1_790_000_000_000),
        occurredAtSource: "paid_at",
        livemode: false,
      }),
    });
  });
  it("falls back to event time explicitly when paid_at is missing", () => {
    const result = invoicePaymentEntry(
      invoice({ status_transitions: { paid_at: null } }),
      "cus_1",
      planFor,
      1_790_000_100,
    );
    expect("entry" in result && result.entry.occurredAtSource).toBe(
      "event_created",
    );
  });
  it.each([
    [{ id: undefined }, "missing invoice id"],
    [{ livemode: true }, "not a test-mode invoice"],
    [{ livemode: undefined }, "not a test-mode invoice"],
    [{ customer: "cus_other" }, "customer mismatch"],
    [{ status: "open" }, "invoice not paid"],
    [{ amount_paid: -1 }, "invalid amount"],
    [{ amount_paid: 1.5 }, "invalid amount"],
    [{ amount_paid: "999" }, "invalid amount"],
    [{ currency: "pounds" }, "invalid currency"],
    [{ currency: undefined }, "invalid currency"],
    [{ amount_paid_off_stripe: 100 }, "paid outside Stripe"],
  ])("fails closed on malformed payload %o", (extra, reason) => {
    expect(invoicePaymentEntry(invoice(extra), "cus_1", planFor, 0)).toEqual(
      expect.objectContaining({ gap: reason }),
    );
  });
  it("does not guess an ambiguous payment reference", () => {
    const result = invoicePaymentEntry(
      invoice({ payments: undefined }),
      "cus_1",
      planFor,
      1,
    );
    expect("entry" in result && result.entry.paymentIntentId).toBeNull();
  });
  it("attributes plans only from one configured price", () => {
    const plan = (data: unknown[], has_more = false) =>
      invoicePlan(
        { lines: { data, has_more } } as unknown as Stripe.Invoice,
        planFor,
      );
    expect(plan([line("price_a"), line({ id: "price_a" })])).toEqual({
      plan: "annual",
      priceId: "price_a",
    });
    expect(plan([line("price_m"), line("price_a")]).plan).toBeNull();
    expect(plan([line("price_unknown")])).toEqual({
      plan: null,
      priceId: "price_unknown",
    });
    expect(plan([line("price_m")], true).plan).toBeNull();
    expect(plan([]).plan).toBeNull();
  });
  it("validates refunds and disputes", () => {
    const refund = {
      id: "re_1",
      amount: 500,
      currency: "gbp",
      status: "succeeded",
      created: 1_790_000_000,
      charge: "ch_1",
      payment_intent: "pi_1",
    } as Stripe.Refund;
    expect(refundEntry(refund)).toEqual({
      entry: expect.objectContaining({
        entryKey: "stripe:refund:re_1",
        kind: "refund",
        amountMinor: 500,
        status: "succeeded",
      }),
    });
    expect(refundEntry({ ...refund, amount: -5 })).toMatchObject({
      gap: "invalid amount",
    });
    expect(
      refundEntry({ ...refund, status: null as unknown as string }),
    ).toMatchObject({ gap: "missing status" });
    const dispute = {
      id: "dp_1",
      amount: 999,
      currency: "gbp",
      status: "lost",
      created: 1_790_000_000,
      livemode: false,
      charge: "ch_1",
      payment_intent: null,
    } as unknown as Stripe.Dispute;
    expect(disputeEntry(dispute)).toMatchObject({
      entry: { kind: "dispute", status: "lost", paymentIntentId: null },
    });
    expect(disputeEntry({ ...dispute, livemode: true })).toMatchObject({
      gap: "not a test-mode dispute",
    });
  });
});

describe("subscription transitions", () => {
  const state = (extra = {}) => ({
    status: "active",
    plan: "monthly",
    cancel_at_period_end: false,
    paid_until: new Date("2026-10-01T00:00:00Z"),
    ...extra,
  });
  it("classifies creation, no-op and each state change", () => {
    expect(classifyTransition(null, state())).toEqual(["created"]);
    expect(classifyTransition(state(), state())).toEqual([]);
    expect(
      classifyTransition(state(), state({ cancel_at_period_end: true })),
    ).toEqual(["cancellation_scheduled"]);
    expect(
      classifyTransition(
        state({ cancel_at_period_end: true }),
        state({ cancel_at_period_end: false }),
      ),
    ).toEqual(["cancellation_unscheduled"]);
    expect(classifyTransition(state(), state({ status: "canceled" }))).toEqual([
      "status_changed",
      "canceled",
    ]);
    expect(classifyTransition(state({ status: "canceled" }), state())).toEqual([
      "status_changed",
      "reactivated",
    ]);
    expect(classifyTransition(state(), state({ plan: "annual" }))).toEqual([
      "plan_changed",
    ]);
    expect(
      classifyTransition(
        state(),
        state({ paid_until: new Date("2026-11-01T00:00:00Z") }),
      ),
    ).toEqual(["paid_through_changed"]);
    expect(classifyTransition(state(), state({ status: "past_due" }))).toEqual([
      "status_changed",
    ]);
  });
});
