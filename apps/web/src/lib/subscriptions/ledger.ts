import type Stripe from "stripe";
import type { PoolClient } from "pg";
import type { Plan } from "./policy";

/**
 * Durable payment/refund/dispute ledger. Extraction is pure and fail-closed:
 * an object that cannot be verified or is missing a required field becomes a
 * recorded gap, never a guessed amount. Writes are keyed by provider object ID
 * so duplicate or concurrent webhook delivery cannot double-count money.
 */
export interface LedgerEntry {
  entryKey: string;
  kind: "payment" | "refund" | "dispute";
  providerObjectId: string;
  subscriptionId: string | null;
  invoiceId: string | null;
  paymentIntentId: string | null;
  chargeId: string | null;
  amountMinor: number;
  currency: string;
  status: string;
  plan: Plan | null;
  priceId: string | null;
  livemode: boolean;
  occurredAt: Date;
  occurredAtSource: "paid_at" | "object_created" | "event_created";
  /** Stripe invoice billing_reason (payments only): subscription_create = new, subscription_cycle = renewal. */
  billingReason?: string | null;
}
export type Extracted =
  | { entry: LedgerEntry }
  | { gap: string; objectId: string; kind: LedgerEntry["kind"] };

const ref = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : (value?.id ?? null);
const minor = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const currency = (value: unknown) =>
  typeof value === "string" && /^[a-z]{3}$/i.test(value)
    ? value.toLowerCase()
    : null;
const seconds = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? new Date(value * 1000)
    : null;

/** Plan is attributed only when every priced line maps to one configured plan. */
export function invoicePlan(
  invoice: Pick<Stripe.Invoice, "lines">,
  planFor: (priceId: string) => Plan | null,
): { plan: Plan | null; priceId: string | null } {
  const prices = new Set<string>();
  for (const line of invoice.lines?.data ?? []) {
    const price = ref(
      line.pricing?.price_details?.price as string | { id: string } | null,
    );
    if (price) prices.add(price);
  }
  if (invoice.lines?.has_more || prices.size !== 1)
    return { plan: null, priceId: null };
  const [priceId] = prices;
  return { plan: planFor(priceId), priceId };
}

export function invoicePaymentEntry(
  invoice: Stripe.Invoice,
  customerId: string,
  planFor: (priceId: string) => Plan | null,
  eventCreated: number,
): Extracted {
  const gap = (reason: string): Extracted => ({
    gap: reason,
    objectId: String(invoice?.id ?? "unknown"),
    kind: "payment",
  });
  if (!invoice?.id || typeof invoice.id !== "string")
    return gap("missing invoice id");
  if (invoice.livemode !== false) return gap("not a test-mode invoice");
  if (ref(invoice.customer) !== customerId) return gap("customer mismatch");
  if (invoice.status !== "paid") return gap("invoice not paid");
  if (!minor(invoice.amount_paid)) return gap("invalid amount");
  const code = currency(invoice.currency);
  if (!code) return gap("invalid currency");
  if ((invoice.amount_paid_off_stripe ?? 0) > 0)
    return gap("paid outside Stripe");
  const paidAt = seconds(invoice.status_transitions?.paid_at);
  const fallback = seconds(eventCreated);
  if (!paidAt && !fallback) return gap("missing occurrence time");
  const payments = invoice.payments?.data ?? [];
  const paid = payments.filter((p) => p.status === "paid");
  const payment = paid.length === 1 ? paid[0].payment : undefined;
  const { plan, priceId } = invoicePlan(invoice, planFor);
  return {
    entry: {
      entryKey: `stripe:invoice:${invoice.id}`,
      kind: "payment",
      providerObjectId: invoice.id,
      subscriptionId: ref(
        invoice.parent?.subscription_details?.subscription as
          string | { id: string } | null,
      ),
      invoiceId: invoice.id,
      paymentIntentId: ref(payment?.payment_intent ?? null),
      chargeId: ref(payment?.charge ?? null),
      amountMinor: invoice.amount_paid,
      currency: code,
      status: "paid",
      plan,
      priceId,
      livemode: false,
      occurredAt: paidAt ?? fallback!,
      occurredAtSource: paidAt ? "paid_at" : "event_created",
      billingReason:
        typeof invoice.billing_reason === "string" &&
        /^[a-z_]{1,40}$/.test(invoice.billing_reason)
          ? invoice.billing_reason
          : null,
    },
  };
}

export function refundEntry(refund: Stripe.Refund): Extracted {
  const gap = (reason: string): Extracted => ({
    gap: reason,
    objectId: String(refund?.id ?? "unknown"),
    kind: "refund",
  });
  if (!refund?.id || typeof refund.id !== "string")
    return gap("missing refund id");
  const code = currency(refund.currency);
  if (!minor(refund.amount)) return gap("invalid amount");
  if (!code) return gap("invalid currency");
  if (typeof refund.status !== "string" || !refund.status)
    return gap("missing status");
  const created = seconds(refund.created);
  if (!created) return gap("missing occurrence time");
  return {
    entry: {
      entryKey: `stripe:refund:${refund.id}`,
      kind: "refund",
      providerObjectId: refund.id,
      subscriptionId: null,
      invoiceId: null,
      paymentIntentId: ref(refund.payment_intent),
      chargeId: ref(refund.charge),
      amountMinor: refund.amount,
      currency: code,
      status: refund.status,
      plan: null,
      priceId: null,
      livemode: false,
      occurredAt: created,
      occurredAtSource: "object_created",
    },
  };
}

export function disputeEntry(dispute: Stripe.Dispute): Extracted {
  const gap = (reason: string): Extracted => ({
    gap: reason,
    objectId: String(dispute?.id ?? "unknown"),
    kind: "dispute",
  });
  if (!dispute?.id || typeof dispute.id !== "string")
    return gap("missing dispute id");
  if (dispute.livemode !== false) return gap("not a test-mode dispute");
  const code = currency(dispute.currency);
  if (!minor(dispute.amount)) return gap("invalid amount");
  if (!code) return gap("invalid currency");
  if (typeof dispute.status !== "string" || !dispute.status)
    return gap("missing status");
  const created = seconds(dispute.created);
  if (!created) return gap("missing occurrence time");
  return {
    entry: {
      entryKey: `stripe:dispute:${dispute.id}`,
      kind: "dispute",
      providerObjectId: dispute.id,
      subscriptionId: null,
      invoiceId: null,
      paymentIntentId: ref(dispute.payment_intent),
      chargeId: ref(dispute.charge),
      amountMinor: dispute.amount,
      currency: code,
      status: dispute.status,
      plan: null,
      priceId: null,
      livemode: false,
      occurredAt: created,
      occurredAtSource: "object_created",
    },
  };
}

/**
 * Idempotent write. Payment facts are immutable once recorded; refund and
 * dispute status may legitimately progress (pending → succeeded, open → lost),
 * so only status/updated_at change on a replay. Refunds/disputes inherit
 * subscription/invoice/plan from the recorded payment with the same intent.
 */
export async function writeLedger(
  db: PoolClient,
  userId: string,
  customerId: string,
  eventId: string,
  result: Extracted,
) {
  if ("gap" in result) {
    await db.query(
      `INSERT INTO mtm_ledger_gaps(gap_key,user_id,kind,provider_object_id,reason,source_event_id)
       VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
      [
        `${eventId}:${result.objectId}`,
        userId,
        result.kind,
        result.objectId.slice(0, 255),
        result.gap,
        eventId,
      ],
    );
    return false;
  }
  const e = result.entry;
  await db.query(
    `INSERT INTO mtm_ledger_entries(entry_key,provider,kind,user_id,provider_customer_id,provider_subscription_id,provider_invoice_id,
      provider_payment_intent_id,provider_charge_id,provider_object_id,amount_minor,currency,status,plan,price_id,livemode,
      provider_occurred_at,occurred_at_source,source,source_event_id,billing_reason)
     SELECT $1,'stripe',$2,$3,$4,COALESCE($5,p.provider_subscription_id),COALESCE($6,p.provider_invoice_id),$7,$8,$9,$10,$11,$12,
      COALESCE($13,p.plan),COALESCE($14,p.price_id),$15,$16,$17,'webhook',$18,$19
     FROM (SELECT 1) one LEFT JOIN LATERAL (
      SELECT provider_subscription_id,provider_invoice_id,plan,price_id FROM mtm_ledger_entries
      WHERE kind='payment' AND $2<>'payment' AND provider_payment_intent_id=$7 AND user_id=$3 LIMIT 1) p ON true
     ON CONFLICT (entry_key) DO UPDATE SET
      status=CASE WHEN mtm_ledger_entries.kind='payment' THEN mtm_ledger_entries.status ELSE excluded.status END,
      updated_at=CASE WHEN mtm_ledger_entries.kind<>'payment' AND mtm_ledger_entries.status<>excluded.status
        THEN now() ELSE mtm_ledger_entries.updated_at END
     WHERE mtm_ledger_entries.user_id=excluded.user_id`,
    [
      e.entryKey,
      e.kind,
      userId,
      customerId,
      e.subscriptionId,
      e.invoiceId,
      e.paymentIntentId,
      e.chargeId,
      e.providerObjectId,
      e.amountMinor,
      e.currency,
      e.status,
      e.plan,
      e.priceId,
      e.livemode,
      e.occurredAt,
      e.occurredAtSource,
      eventId,
      e.billingReason ?? null,
    ],
  );
  return true;
}

export interface PaymentFailure {
  invoiceId: string;
  subscriptionId: string | null;
  amountDueMinor: number;
  currency: string;
  failedAt: Date;
}

/** A failed attempt's value is the invoice amount due; unverifiable invoices become gaps. */
export function invoiceFailureEntry(
  invoice: Stripe.Invoice,
  customerId: string,
  eventCreated: number,
): { failure: PaymentFailure } | Extract<Extracted, { gap: string }> {
  const gap = (reason: string) => ({
    gap: reason,
    objectId: String(invoice?.id ?? "unknown"),
    kind: "payment" as const,
  });
  if (!invoice?.id || typeof invoice.id !== "string")
    return gap("missing invoice id");
  if (invoice.livemode !== false) return gap("not a test-mode invoice");
  if (ref(invoice.customer) !== customerId) return gap("customer mismatch");
  if (!minor(invoice.amount_due)) return gap("invalid amount due");
  const code = currency(invoice.currency);
  if (!code) return gap("invalid currency");
  const failedAt = seconds(eventCreated);
  if (!failedAt) return gap("missing occurrence time");
  return {
    failure: {
      invoiceId: invoice.id,
      subscriptionId: ref(
        invoice.parent?.subscription_details?.subscription as
          string | { id: string } | null,
      ),
      amountDueMinor: invoice.amount_due,
      currency: code,
      failedAt,
    },
  };
}

/** One row per invoice; each distinct failed-payment event (already deduplicated by receipt) adds an attempt. */
export async function writeFailure(
  db: PoolClient,
  userId: string,
  customerId: string,
  eventId: string,
  result: ReturnType<typeof invoiceFailureEntry>,
) {
  if ("gap" in result)
    return writeLedger(db, userId, customerId, eventId, result);
  const f = result.failure;
  await db.query(
    `INSERT INTO mtm_payment_failures(provider_invoice_id,user_id,provider_subscription_id,amount_due_minor,currency,livemode,first_failed_at,last_failed_at,source_event_id)
     VALUES($1,$2,$3,$4,$5,false,$6,$6,$7)
     ON CONFLICT (provider_invoice_id) DO UPDATE SET
      attempts=mtm_payment_failures.attempts+1,
      amount_due_minor=excluded.amount_due_minor,
      first_failed_at=LEAST(mtm_payment_failures.first_failed_at,excluded.first_failed_at),
      last_failed_at=GREATEST(mtm_payment_failures.last_failed_at,excluded.last_failed_at)
     WHERE mtm_payment_failures.user_id=excluded.user_id AND mtm_payment_failures.currency=excluded.currency`,
    [
      f.invoiceId,
      userId,
      f.subscriptionId,
      f.amountDueMinor,
      f.currency,
      f.failedAt,
      eventId,
    ],
  );
  return true;
}

export interface SubscriptionState {
  status: string;
  plan: string;
  cancel_at_period_end: boolean;
  paid_until: Date | null;
}

/** Names every change between two projected states; an empty list is no transition. */
export function classifyTransition(
  prev: SubscriptionState | null,
  next: SubscriptionState,
): string[] {
  if (!prev) return ["created"];
  const t: string[] = [];
  if (prev.status !== next.status) {
    t.push("status_changed");
    if (next.status === "canceled") t.push("canceled");
    if (prev.status === "canceled" && next.status === "active")
      t.push("reactivated");
  }
  if (prev.plan !== next.plan) t.push("plan_changed");
  if (!prev.cancel_at_period_end && next.cancel_at_period_end)
    t.push("cancellation_scheduled");
  if (prev.cancel_at_period_end && !next.cancel_at_period_end)
    t.push("cancellation_unscheduled");
  const before = prev.paid_until?.getTime() ?? null;
  const after = next.paid_until?.getTime() ?? null;
  if (before !== after) t.push("paid_through_changed");
  return t;
}
