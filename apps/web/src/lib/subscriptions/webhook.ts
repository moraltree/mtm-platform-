import type Stripe from "stripe";
import type { PoolClient } from "pg";
import { billingStripe, checkedPrice, priceId } from "./config";
import { transaction, recordEvent, type Account } from "./db";
import { metadata, stripeId } from "./billing";
import { beginTrial } from "./trials";
import { parsePlan, type Plan } from "./policy";
import {
  classifyTransition,
  disputeEntry,
  invoiceFailureEntry,
  invoicePaymentEntry,
  refundEntry,
  writeFailure,
  writeLedger,
  type SubscriptionState,
} from "./ledger";

const date = (seconds: number | null | undefined) =>
  seconds ? new Date(seconds * 1000) : null;

/** Maps a Price to a plan through server configuration only; unknown is unattributed. */
function planFor(price: string): Plan | null {
  for (const plan of ["monthly", "annual"] as const) {
    try {
      if (priceId(plan) === price) return plan;
    } catch {
      // Unconfigured prices attribute nothing.
    }
  }
  return null;
}

async function syncSubscription(
  db: PoolClient,
  stripe: Stripe,
  account: Account,
  id: string,
  event: Stripe.Event,
) {
  // Retrieve inside the account lock. Arrival order does not become state order.
  const sub = await stripe.subscriptions.retrieve(id, {
    expand: ["latest_invoice"],
  });
  if (
    sub.livemode ||
    stripeId(sub.customer) !== account.customer_id ||
    sub.metadata.userId !== account.id ||
    sub.metadata.mtm !== "subscriptions-v1"
  )
    throw new Error("Subscription linkage mismatch");
  const item = sub.items.data[0];
  const plan =
    item?.price.id === priceId("monthly")
      ? "monthly"
      : item?.price.id === priceId("annual")
        ? "annual"
        : null;
  if (
    !plan ||
    sub.items.data.length !== 1 ||
    item.quantity !== 1 ||
    sub.items.has_more
  )
    throw new Error("Unexpected subscription items");
  const invoice =
    typeof sub.latest_invoice === "object" ? sub.latest_invoice : null;
  // A zero-value trial invoice is never a paid conversion. No entitlement from status alone.
  const paid =
    invoice?.status === "paid" && invoice.amount_paid > 0 && !invoice.livemode;
  const previous = (
    await db.query<SubscriptionState>(
      "SELECT status,plan,cancel_at_period_end,paid_until FROM mtm_subscriptions WHERE stripe_id=$1",
      [sub.id],
    )
  ).rows[0];
  // Contract snapshot for MRR. Unsupported pricing shapes store no amount rather than a guess.
  const recurring = item.price.recurring;
  const contract =
    item.price.unit_amount != null &&
    item.price.billing_scheme !== "tiered" &&
    /^[a-z]{3}$/i.test(item.price.currency ?? "") &&
    (recurring?.interval === "month" || recurring?.interval === "year") &&
    recurring.usage_type === "licensed"
      ? {
          amount: item.price.unit_amount,
          currency: item.price.currency.toLowerCase(),
          interval: recurring.interval,
          count: recurring.interval_count,
        }
      : null;
  const current = (
    await db.query<SubscriptionState>(
      `INSERT INTO mtm_subscriptions(stripe_id,user_id,customer_id,plan,status,period_start,period_end,paid_until,cancel_at_period_end,cancel_at,canceled_at,stripe_trial_start,stripe_trial_end,
    price_id,unit_amount_minor,currency,billing_interval,interval_count,quantity,discounted,contract_recorded_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,CASE WHEN $15::bigint IS NULL THEN NULL ELSE now() END)
    ON CONFLICT(stripe_id) DO UPDATE SET plan=excluded.plan,status=excluded.status,period_start=excluded.period_start,period_end=excluded.period_end,
    paid_until=COALESCE(excluded.paid_until,mtm_subscriptions.paid_until),cancel_at_period_end=excluded.cancel_at_period_end,cancel_at=excluded.cancel_at,canceled_at=excluded.canceled_at,
    stripe_trial_start=excluded.stripe_trial_start,stripe_trial_end=excluded.stripe_trial_end,updated_at=now(),
    price_id=excluded.price_id,unit_amount_minor=excluded.unit_amount_minor,currency=excluded.currency,billing_interval=excluded.billing_interval,
    interval_count=excluded.interval_count,quantity=excluded.quantity,discounted=excluded.discounted,contract_recorded_at=excluded.contract_recorded_at
    RETURNING status,plan,cancel_at_period_end,paid_until`,
      [
        sub.id,
        account.id,
        account.customer_id,
        plan,
        sub.pause_collection ? "paused" : sub.status,
        date(item.current_period_start),
        date(item.current_period_end),
        paid ? date(item.current_period_end) : null,
        sub.cancel_at_period_end,
        date(sub.cancel_at),
        date(sub.canceled_at),
        date(sub.trial_start),
        date(sub.trial_end),
        item.price.id,
        contract?.amount ?? null,
        contract?.currency ?? null,
        contract?.interval ?? null,
        contract?.count ?? null,
        item.quantity,
        (sub.discounts?.length ?? 0) > 0 || (item.discounts?.length ?? 0) > 0,
      ],
    )
  ).rows[0];
  const transitions = classifyTransition(previous ?? null, current);
  if (transitions.length)
    await db.query(
      `INSERT INTO mtm_subscription_history(subscription_id,user_id,source,source_event_id,provider_event_created_at,transitions,
      prev_status,status,prev_plan,plan,prev_cancel_at_period_end,cancel_at_period_end,prev_paid_until,paid_until)
      VALUES($1,$2,'webhook',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT DO NOTHING`,
      [
        sub.id,
        account.id,
        event.id,
        date(event.created),
        transitions,
        previous?.status ?? null,
        current.status,
        previous?.plan ?? null,
        current.plan,
        previous?.cancel_at_period_end ?? null,
        current.cancel_at_period_end,
        previous?.paid_until ?? null,
        current.paid_until,
      ],
    );
  if (paid) {
    await recordEvent(
      db,
      account.id,
      `paid:${sub.id}`,
      "PAID_SUBSCRIPTION_CONFIRMED",
      { plan, subscriptionId: sub.id, invoiceId: invoice.id },
    );
    if (account.trial_status !== "converted") {
      await db.query(
        "UPDATE mtm_accounts SET trial_status='converted' WHERE id=$1",
        [account.id],
      );
      if (account.trial_start && account.trial_days > 0) {
        await recordEvent(
          db,
          account.id,
          `trial-converted:${account.id}`,
          "TRIAL_CONVERTED",
          { plan, subscriptionId: sub.id },
        );
      }
      account.trial_status = "converted";
    }
  }
  if (
    sub.status === "canceled" &&
    account.auto_convert &&
    account.trial_status === "active"
  ) {
    await db.query(
      "UPDATE mtm_accounts SET trial_status='cancelled' WHERE id=$1",
      [account.id],
    );
    await recordEvent(
      db,
      account.id,
      `trial-cancelled:${account.id}`,
      "TRIAL_CANCELLED",
    );
  }
  return sub;
}

/**
 * Money facts come from provider objects retrieved inside the account lock,
 * never from counts or configured prices. Unverifiable objects become gaps.
 */
async function recordLedger(
  db: PoolClient,
  stripe: Stripe,
  account: Account,
  event: Stripe.Event,
) {
  const customer = account.customer_id!;
  const object = event.data.object as { id: string; charge?: unknown };
  if (
    event.type === "invoice.paid" ||
    event.type === "invoice.payment_succeeded"
  ) {
    const invoice = await stripe.invoices.retrieve(object.id, {
      expand: ["payments"],
    });
    await writeLedger(
      db,
      account.id,
      customer,
      event.id,
      invoicePaymentEntry(invoice, customer, planFor, event.created),
    );
  }
  if (event.type === "invoice.payment_failed") {
    const invoice = await stripe.invoices.retrieve(object.id);
    await writeFailure(
      db,
      account.id,
      customer,
      event.id,
      invoiceFailureEntry(invoice, customer, event.created),
    );
  }
  if (
    event.type === "charge.refunded" ||
    event.type === "charge.refund.updated"
  ) {
    const chargeId =
      event.type === "charge.refunded"
        ? object.id
        : stripeId(object.charge as string);
    const charge = chargeId ? await stripe.charges.retrieve(chargeId) : null;
    if (
      !charge ||
      charge.livemode !== false ||
      stripeId(charge.customer) !== customer
    ) {
      await writeLedger(db, account.id, customer, event.id, {
        gap: "refund charge not verified",
        objectId: chargeId ?? object.id,
        kind: "refund",
      });
      return;
    }
    const refunds = await stripe.refunds.list({
      charge: charge.id,
      limit: 100,
    });
    if (refunds.has_more)
      await writeLedger(db, account.id, customer, event.id, {
        gap: "more refunds than one page",
        objectId: charge.id,
        kind: "refund",
      });
    for (const refund of refunds.data)
      await writeLedger(
        db,
        account.id,
        customer,
        event.id,
        refundEntry(refund),
      );
  }
  if (event.type.startsWith("charge.dispute.")) {
    const dispute = await stripe.disputes.retrieve(object.id);
    await writeLedger(
      db,
      account.id,
      customer,
      event.id,
      disputeEntry(dispute),
    );
  }
}

/** Durable event receipt and all state/analytics writes commit or roll back together. */
export async function processSubscriptionEvent(event: Stripe.Event) {
  if (event.livemode) throw new Error("Live Stripe events are forbidden");
  const stripe = billingStripe();
  const object = event.data.object as unknown as {
    id: string;
    customer?: string | { id: string };
    metadata?: Record<string, string>;
  };
  const relevant =
    event.type.startsWith("customer.subscription.") ||
    event.type.startsWith("invoice.") ||
    event.type.startsWith("checkout.session.") ||
    event.type.startsWith("charge.") ||
    event.type === "customer.deleted" ||
    event.type === "customer.updated";
  if (!relevant) return;
  let customerId = stripeId(object.customer);
  if (
    event.type.startsWith("customer.") &&
    !event.type.startsWith("customer.subscription.")
  )
    customerId = object.id;
  if (
    event.type.startsWith("charge.dispute.") ||
    event.type === "charge.refund.updated"
  ) {
    // Disputes and refunds carry no customer; resolve ownership from their charge.
    const owned = event.data.object as Stripe.Dispute | Stripe.Refund;
    const chargeRef = stripeId(owned.charge);
    if (!chargeRef) return;
    const charge = await stripe.charges.retrieve(chargeRef);
    customerId = stripeId(charge.customer);
  }
  if (!customerId) return;
  await transaction(async (db) => {
    const account = (
      await db.query<Account>(
        "SELECT * FROM mtm_accounts WHERE customer_id=$1 FOR UPDATE",
        [customerId],
      )
    ).rows[0];
    if (!account) {
      // Events may race a customer creation transaction. Retry tagged MTM customers.
      const customer = await stripe.customers.retrieve(customerId!);
      if (!customer.deleted && customer.metadata.mtm === "subscriptions-v1")
        throw new Error("Customer linkage not committed yet");
      return;
    }
    const receipt = await db.query(
      "INSERT INTO mtm_webhook_events(stripe_event_id,event_type) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING stripe_event_id",
      [event.id, event.type],
    );
    if (!receipt.rowCount) return;
    let subscriptionId: string | undefined;
    if (event.type.startsWith("customer.subscription."))
      subscriptionId = object.id;
    if (event.type.startsWith("invoice."))
      subscriptionId = stripeId(
        (event.data.object as Stripe.Invoice).parent?.subscription_details
          ?.subscription,
      );
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = await stripe.checkout.sessions.retrieve(object.id);
      if (
        session.livemode ||
        session.status !== "complete" ||
        stripeId(session.customer) !== account.customer_id ||
        session.metadata?.mtm !== "subscriptions-v1" ||
        session.metadata.userId !== account.id ||
        session.client_reference_id !== account.id
      )
        throw new Error("Checkout linkage mismatch");
      subscriptionId = stripeId(session.subscription);
      if (session.mode === "setup" && account.trial_status === "offered") {
        const intent = await stripe.setupIntents.retrieve(
          stripeId(session.setup_intent)!,
        );
        if (
          intent.livemode ||
          intent.status !== "succeeded" ||
          stripeId(intent.customer) !== account.customer_id ||
          !account.card_required
        )
          throw new Error("Card setup not confirmed");
        const plan = parsePlan(session.metadata.plan);
        await checkedPrice(stripe, plan);
        // One absolute platform deadline. Stripe mirrors it only to schedule conversion.
        await beginTrial(db, account, new Date(event.created * 1000));
        if (
          account.auto_convert &&
          account.trial_end &&
          account.trial_days > 0
        ) {
          const sub = await stripe.subscriptions.create(
            {
              customer: customerId!,
              items: [{ price: priceId(plan) }],
              default_payment_method: stripeId(intent.payment_method),
              trial_end: Math.floor(account.trial_end.getTime() / 1000),
              metadata: metadata(account, plan),
            },
            { idempotencyKey: `mtm-trial:${account.id}` },
          );
          subscriptionId = sub.id;
        }
      }
      await db.query(
        "DELETE FROM mtm_checkout_attempts WHERE user_id=$1 AND session_id=$2",
        [account.id, session.id],
      );
    }
    if (subscriptionId)
      await syncSubscription(db, stripe, account, subscriptionId, event);
    await recordLedger(db, stripe, account, event);
    if (event.type === "customer.deleted") {
      await db.query(
        "UPDATE mtm_accounts SET blocked=true,trial_status='cancelled' WHERE id=$1",
        [account.id],
      );
      await db.query(
        "UPDATE mtm_subscriptions SET status='canceled',paid_until=NULL WHERE user_id=$1",
        [account.id],
      );
      await recordEvent(
        db,
        account.id,
        `trial-cancelled:${account.id}`,
        "TRIAL_CANCELLED",
      );
    }
    // Refund/dispute hooks are durable, separate from reward issuance. A dispute revokes access.
    if (event.type === "charge.dispute.created")
      await db.query("UPDATE mtm_accounts SET blocked=true WHERE id=$1", [
        account.id,
      ]);
    const type =
      event.type === "invoice.payment_failed"
        ? "PAYMENT_FAILED"
        : event.type === "invoice.paid"
          ? "PAYMENT_SUCCEEDED"
          : event.type === "customer.subscription.deleted"
            ? "SUBSCRIPTION_CANCELLED"
            : event.type === "charge.refunded"
              ? "REFUND"
              : event.type.startsWith("charge.dispute.")
                ? "CHARGEBACK"
                : "STRIPE_LIFECYCLE";
    await recordEvent(db, account.id, event.id, type, {
      stripeType: event.type,
      objectId: object.id,
      subscriptionId,
    });
  });
}
