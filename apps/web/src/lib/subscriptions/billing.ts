import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { billingStripe, checkedPrice, origin, priceId } from "./config";
import { transaction, type Account } from "./db";
import { parsePlan, type Plan } from "./policy";

export function stripeId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id;
}

export function metadata(account: Account, plan: Plan) {
  const r = account.registration;
  return {
    mtm: "subscriptions-v1",
    userId: account.id,
    plan,
    campaignId: String(r.campaignId ?? "").slice(0, 500),
    source: String(r.acquisitionSource ?? "").slice(0, 500),
    offer: String(
      (r.offer as { offerType?: string } | undefined)?.offerType ?? "",
    ).slice(0, 500),
  };
}

export async function checkout(
  userId: string,
  input: unknown,
  kind: "paid" | "trial",
) {
  const plan = parsePlan(input);
  const stripe = billingStripe();
  const selectedPrice = await checkedPrice(stripe, plan);
  // Persist the operation key before Stripe calls: retries after network/DB failures reuse it.
  await transaction(async (db) => {
    await db.query(
      `INSERT INTO mtm_checkout_attempts(user_id,attempt_id,plan,kind,expires_at)
      VALUES($1,$2,$3,$4,now()+interval '23 hours') ON CONFLICT DO NOTHING`,
      [userId, randomUUID(), plan, kind],
    );
  });
  return transaction(async (db) => {
    const account = (
      await db.query<Account>(
        "SELECT * FROM mtm_accounts WHERE id=$1 FOR UPDATE",
        [userId],
      )
    ).rows[0];
    if (!account || account.blocked) throw new Error("Account unavailable");
    const attempt = (
      await db.query("SELECT * FROM mtm_checkout_attempts WHERE user_id=$1", [
        userId,
      ])
    ).rows[0];
    if (attempt.expires_at <= new Date())
      throw new Error("Checkout needs reconciliation; please contact support");
    if (attempt.plan !== plan || attempt.kind !== kind) {
      if (attempt.session_id) {
        const old = await stripe.checkout.sessions.retrieve(attempt.session_id);
        if (old.status === "open")
          await stripe.checkout.sessions.expire(old.id);
        if (old.status === "complete")
          throw new Error("Payment is processing; refresh shortly");
      } else
        throw new Error(
          "An earlier checkout is processing; retry the original selection",
        );
      await db.query("DELETE FROM mtm_checkout_attempts WHERE user_id=$1", [
        userId,
      ]);
      return `${origin()}/subscribe?notice=retry`;
    }
    if (attempt.session_id) {
      const previous = await stripe.checkout.sessions.retrieve(
        attempt.session_id,
      );
      if (previous.status === "open" && previous.url) return previous.url;
      if (previous.status === "complete")
        return `${origin()}/subscribe?notice=processing`;
      await db.query("DELETE FROM mtm_checkout_attempts WHERE user_id=$1", [
        userId,
      ]);
      return `${origin()}/subscribe?notice=retry`;
    }
    if (!account.customer_id) {
      const customer = await stripe.customers.create(
        { email: account.email, metadata: { mtm: "subscriptions-v1", userId } },
        { idempotencyKey: `mtm-customer:${userId}` },
      );
      if (customer.livemode) throw new Error("Live customer rejected");
      account.customer_id = customer.id;
      await db.query("UPDATE mtm_accounts SET customer_id=$2 WHERE id=$1", [
        userId,
        customer.id,
      ]);
    }
    const existing = await stripe.subscriptions.list({
      customer: account.customer_id,
      status: "all",
      limit: 100,
    });
    const ongoing = existing.data.find(
      (s) => !["canceled", "incomplete_expired"].includes(s.status),
    );
    if (ongoing) {
      if (ongoing.livemode) throw new Error("Live subscription rejected");
      // A parent can convert immediately; the resulting Stripe invoice handles SCA/payment.
      if (
        kind === "paid" &&
        ongoing.status === "trialing" &&
        ongoing.metadata.mtm === "subscriptions-v1" &&
        ongoing.metadata.userId === userId
      ) {
        const updated = await stripe.subscriptions.update(
          ongoing.id,
          {
            trial_end: "now",
            items: [{ id: ongoing.items.data[0].id, price: priceId(plan) }],
            metadata: metadata(account, plan),
            expand: ["latest_invoice"],
          },
          { idempotencyKey: `mtm-upgrade:${attempt.attempt_id}` },
        );
        const invoice = updated.latest_invoice as Stripe.Invoice | null;
        return (
          invoice?.hosted_invoice_url ??
          `${origin()}/subscribe?notice=processing`
        );
      }
      throw new Error("Use billing management for your existing subscription");
    }
    if (existing.has_more)
      throw new Error("Account needs billing reconciliation");
    if (
      kind === "trial" &&
      (!account.card_required ||
        account.trial_status !== "offered" ||
        account.trial_days === 0)
    )
      throw new Error("Trial is not available");
    const library = await db.query(
      "SELECT count(*)::int AS count FROM mtm_library WHERE published=true AND ($1='paid' OR free_selection=true)",
      [kind],
    );
    if (library.rows[0].count < (kind === "trial" ? 30 : 1))
      throw new Error("Library is not ready");
    const meta = metadata(account, plan);
    const session = await stripe.checkout.sessions.create(
      {
        customer: account.customer_id,
        client_reference_id: userId,
        mode: kind === "trial" ? "setup" : "subscription",
        ...(kind === "paid"
          ? {
              line_items: [{ price: priceId(plan), quantity: 1 }],
              subscription_data: { metadata: meta },
            }
          : {
              currency: selectedPrice.currency,
              payment_method_types: ["card"],
              setup_intent_data: { metadata: meta },
            }),
        metadata: { ...meta, kind },
        success_url: `${origin()}/subscribe?notice=processing`,
        cancel_url: `${origin()}/subscribe?notice=cancelled`,
      },
      { idempotencyKey: `mtm-checkout:${attempt.attempt_id}` },
    );
    if (session.livemode || !session.url)
      throw new Error("Invalid test Checkout session");
    await db.query(
      "UPDATE mtm_checkout_attempts SET session_id=$2 WHERE user_id=$1",
      [userId, session.id],
    );
    return session.url;
  });
}

export async function portal(userId: string) {
  return transaction(async (db) => {
    const account = (
      await db.query<Account>(
        "SELECT * FROM mtm_accounts WHERE id=$1 FOR UPDATE",
        [userId],
      )
    ).rows[0];
    if (!account?.customer_id || account.blocked)
      throw new Error("Billing management unavailable");
    const stripe = billingStripe();
    const customer = await stripe.customers.retrieve(account.customer_id);
    if (
      customer.deleted ||
      customer.livemode ||
      customer.metadata.userId !== userId
    )
      throw new Error("Customer linkage mismatch");
    return (
      await stripe.billingPortal.sessions.create({
        customer: account.customer_id,
        return_url: `${origin()}/subscribe`,
      })
    ).url;
  });
}
