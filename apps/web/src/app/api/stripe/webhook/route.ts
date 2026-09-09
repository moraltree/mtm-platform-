import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { isStripeConfigured, stripe } from "@/lib/stripe";
import { sanityWriteClient } from "@/lib/sanity/writeClient";
import { getProductByStripePriceId } from "@/lib/sanity/queries";
import { sendEmail } from "@/lib/email";

/**
 * Unified Stripe webhook endpoint — handles both the WP7 shop (one-time
 * payments) and the subscription billing system (v1).
 *
 * Differentiates shop vs. subscription events via session metadata:
 *   session.metadata.checkoutType === "subscription"  → subscription handler
 *   anything else                                     → shop/order handler
 *
 * Security:
 *   - Signature verified with STRIPE_WEBHOOK_SECRET before any handler runs
 *   - Invalid/unsigned requests rejected with 400
 *   - 503 when not configured, so Stripe retries rather than giving up
 *
 * Idempotency:
 *   - Shop orders: keyed on stripeCheckoutSessionId (Sanity create skips if
 *     a duplicate is detected by Sanity's own de-dup on that unique field)
 *   - Subscription records: `lastStripeEventId` field prevents the same
 *     Stripe event from updating the document twice (duplicate delivery)
 *   - Handler failures: logged, not rethrown, so a bug doesn't make Stripe
 *     retry the same event forever
 */

export async function POST(request: Request) {
  // Read at request time so tests can control the env var, and so a
  // reconfigured deployment picks up the new secret without restarting.
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!isStripeConfigured || !stripe || !webhookSecret) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      webhookSecret,
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      // ── Checkout ──────────────────────────────────────────────────────
      case "checkout.session.completed":
        await handleCheckoutCompleted(event);
        break;

      // ── Subscription lifecycle ─────────────────────────────────────────
      case "customer.subscription.created":
        await handleSubscriptionCreated(event);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event);
        break;

      // ── Invoice / payment ──────────────────────────────────────────────
      case "invoice.paid":
        await handleInvoicePaid(event);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event);
        break;

      // ── Legacy shop events ─────────────────────────────────────────────
      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      default:
        // Every other event type is intentionally ignored — Stripe sends
        // far more event types than this app currently acts on.
        break;
    }
  } catch (error) {
    // Logged, not rethrown: a 5xx here makes Stripe retry the same event
    // repeatedly, which won't fix a handler bug and just adds noise. Stripe's
    // own Dashboard and Sanity's records are the authoritative stores.
    console.error(`Stripe webhook handler failed for ${event.type}:`, error);
  }

  return NextResponse.json({ received: true });
}

// ════════════════════════════════════════════════════════════════════════
// Checkout
// ════════════════════════════════════════════════════════════════════════

async function handleCheckoutCompleted(event: Stripe.Event) {
  if (!stripe) return;
  const session = event.data.object as Stripe.Checkout.Session;

  if (session.metadata?.checkoutType === "subscription") {
    await handleSubscriptionCheckoutCompleted(event.id, session);
  } else {
    await handleShopCheckoutCompleted(session);
  }
}

// ────────────────────────────────────────────────────────────────────────
// Subscription checkout.session.completed
// ────────────────────────────────────────────────────────────────────────

async function handleSubscriptionCheckoutCompleted(
  eventId: string,
  session: Stripe.Checkout.Session,
) {
  const correlationRef =
    session.client_reference_id ??
    session.metadata?.correlationRef ??
    null;

  if (!correlationRef) {
    console.warn(
      "Stripe webhook: subscription checkout.session.completed missing " +
        "client_reference_id / correlationRef metadata — cannot write subscription " +
        "record. Stripe's own Dashboard has the full session.",
      { sessionId: session.id },
    );
    return;
  }

  const stripeCustomerId =
    typeof session.customer === "string" ? session.customer : undefined;
  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : undefined;

  const customerEmail = session.customer_details?.email ?? undefined;
  const now = new Date().toISOString();

  const subscriptionDoc = {
    _type: "subscription",
    correlationRef,
    stripeCheckoutSessionId: session.id,
    stripeCustomerId,
    stripeSubscriptionId,
    plan: session.metadata?.plan ?? undefined,
    status: "incomplete" as const, // upgraded to "active" by invoice.paid
    customerEmail,
    campaignId: session.metadata?.campaignId ?? undefined,
    acquisitionSource: session.metadata?.acquisitionSource ?? undefined,
    partnerId: session.metadata?.partnerId ?? undefined,
    storyWorldId: session.metadata?.storyWorldId ?? undefined,
    lastStripeEventId: eventId,
    createdAt: now,
    updatedAt: now,
  };

  if (!sanityWriteClient) {
    console.warn(
      "Stripe webhook: subscription checkout.session.completed received but " +
        "SANITY_API_WRITE_TOKEN isn't set — subscription not recorded in Sanity. " +
        "Stripe's own Dashboard still has it.",
      { sessionId: session.id, correlationRef },
    );
    return;
  }

  // Idempotency: if a record with this correlationRef already exists
  // (duplicate event delivery), update it rather than creating a duplicate.
  const existing = await sanityWriteClient.fetch<{ _id: string } | null>(
    `*[_type == "subscription" && correlationRef == $ref][0] { _id }`,
    { ref: correlationRef },
  );

  if (existing) {
    await sanityWriteClient
      .patch(existing._id)
      .set({
        stripeCheckoutSessionId: session.id,
        stripeCustomerId,
        stripeSubscriptionId,
        lastStripeEventId: eventId,
        updatedAt: new Date().toISOString(),
      })
      .commit();
  } else {
    await sanityWriteClient.create(subscriptionDoc);
  }

  // Terminate any active platform trial for this email.
  // When a customer with an active free trial subscribes to a paid plan,
  // the trial ends immediately — no unused days carried forward.
  if (customerEmail) {
    await terminatePlatformTrialForEmail(customerEmail);
  }
}

/**
 * Marks any active platform trial (status="trialing", no Stripe subscription)
 * for the given email as cancelled. Called when a customer completes a paid
 * subscription checkout — the trial ends at that moment, regardless of how
 * many trial days remain.
 */
async function terminatePlatformTrialForEmail(email: string): Promise<void> {
  if (!sanityWriteClient) return;

  const normalisedEmail = email.toLowerCase().trim();
  try {
    const trialDoc = await sanityWriteClient.fetch<{ _id: string } | null>(
      `*[
        _type == "subscription" &&
        customerEmail == $email &&
        status == "trialing" &&
        !defined(stripeSubscriptionId)
      ][0] { _id }`,
      { email: normalisedEmail },
    );

    if (!trialDoc) return;

    await sanityWriteClient
      .patch(trialDoc._id)
      .set({
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .commit();
  } catch (err) {
    // Log and continue — failing to terminate the trial record must not
    // block the subscription record from being written. The trial cookie
    // will be replaced by the new paid subscription cookie, so the user
    // gets the correct entitlement regardless.
    console.error(
      "Stripe webhook: failed to terminate platform trial on upgrade:",
      err,
    );
  }
}

// ────────────────────────────────────────────────────────────────────────
// Subscription lifecycle events
// ────────────────────────────────────────────────────────────────────────

async function findSubscriptionDoc(
  stripeSubscriptionId: string,
): Promise<{ _id: string; lastStripeEventId?: string } | null> {
  if (!sanityWriteClient) return null;
  return sanityWriteClient.fetch<{
    _id: string;
    lastStripeEventId?: string;
  } | null>(
    `*[_type == "subscription" && stripeSubscriptionId == $id][0] {
      _id, lastStripeEventId
    }`,
    { id: stripeSubscriptionId },
  );
}

function normaliseSanityStatus(stripeStatus: string): string {
  // Stripe uses "canceled" (one L), Sanity schema uses "cancelled"
  if (stripeStatus === "canceled") return "cancelled";
  return stripeStatus;
}

function subscriptionUpdateFields(
  sub: Stripe.Subscription,
  eventId: string,
): Record<string, unknown> {
  // Note: current_period_start/end were removed in Stripe API version
  // 2025+. Period dates must be derived from invoices when needed.
  const trialEndTs = sub.trial_end
    ? new Date(sub.trial_end * 1000).toISOString()
    : undefined;
  return {
    status: normaliseSanityStatus(sub.status),
    stripeCustomerId:
      typeof sub.customer === "string" ? sub.customer : undefined,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    cancelledAt: sub.canceled_at
      ? new Date(sub.canceled_at * 1000).toISOString()
      : undefined,
    // trialEnd (from Stripe) — the authoritative trial expiry date.
    // Only updated when the subscription has a trial; existing value
    // is preserved when trial_end is null (e.g. after trial converts).
    ...(trialEndTs !== undefined && { trialEnd: trialEndTs }),
    lastStripeEventId: eventId,
    updatedAt: new Date().toISOString(),
  };
}

async function handleSubscriptionCreated(event: Stripe.Event) {
  if (!sanityWriteClient) return;
  const sub = event.data.object as Stripe.Subscription;

  // Prefer the existing record created by checkout.session.completed.
  // If it's missing (e.g. checkout event arrived out of order), we can
  // still update it when it arrives — the correlationRef in metadata
  // links the two.
  const doc = await findSubscriptionDoc(sub.id);
  if (!doc) {
    console.info(
      "Stripe webhook: customer.subscription.created — no existing subscription " +
        "document found for subscriptionId " + sub.id +
        ". Will be written when checkout.session.completed arrives.",
    );
    return;
  }

  await sanityWriteClient
    .patch(doc._id)
    .set(subscriptionUpdateFields(sub, event.id))
    .commit();
}

async function handleSubscriptionUpdated(event: Stripe.Event) {
  if (!sanityWriteClient) return;
  const sub = event.data.object as Stripe.Subscription;

  const doc = await findSubscriptionDoc(sub.id);
  if (!doc) return;

  // Idempotency: skip if this exact event was already processed.
  if (doc.lastStripeEventId === event.id) {
    console.info(
      `Stripe webhook: customer.subscription.updated event ${event.id} ` +
        "already processed — skipping duplicate delivery.",
    );
    return;
  }

  await sanityWriteClient
    .patch(doc._id)
    .set(subscriptionUpdateFields(sub, event.id))
    .commit();
}

async function handleSubscriptionDeleted(event: Stripe.Event) {
  if (!sanityWriteClient) {
    console.warn(
      "Stripe webhook: customer.subscription.deleted received but SANITY_API_WRITE_TOKEN " +
        "isn't set — subscription status not updated.",
      { subscriptionId: (event.data.object as Stripe.Subscription).id },
    );
    return;
  }

  const sub = event.data.object as Stripe.Subscription;
  const doc = await findSubscriptionDoc(sub.id);

  if (!doc) {
    // May be a shop subscription (pre-dates v1 subscription records) —
    // fall through to the legacy shop handler.
    await handleLegacySubscriptionDeleted(sub);
    return;
  }

  if (doc.lastStripeEventId === event.id) {
    console.info(
      `Stripe webhook: customer.subscription.deleted event ${event.id} ` +
        "already processed — skipping duplicate delivery.",
    );
    return;
  }

  await sanityWriteClient
    .patch(doc._id)
    .set({
      status: "cancelled",
      cancelledAt: sub.canceled_at
        ? new Date(sub.canceled_at * 1000).toISOString()
        : new Date().toISOString(),
      lastStripeEventId: event.id,
      updatedAt: new Date().toISOString(),
    })
    .commit();
}

// ────────────────────────────────────────────────────────────────────────
// Invoice events
// ────────────────────────────────────────────────────────────────────────

async function handleInvoicePaid(event: Stripe.Event) {
  if (!sanityWriteClient) return;
  const invoice = event.data.object as Stripe.Invoice;

  // In Stripe API ≥2025, subscription is accessed via parent.subscription_details
  const subRef = invoice.parent?.subscription_details?.subscription;
  const subscriptionId =
    typeof subRef === "string" ? subRef : (subRef as Stripe.Subscription | undefined)?.id ?? null;
  if (!subscriptionId) return;

  const doc = await findSubscriptionDoc(subscriptionId);
  if (!doc) return;

  if (doc.lastStripeEventId === event.id) {
    console.info(
      `Stripe webhook: invoice.paid event ${event.id} already processed — ` +
        "skipping duplicate delivery.",
    );
    return;
  }

  // invoice.paid confirms the subscription is live — upgrade status to active.
  await sanityWriteClient
    .patch(doc._id)
    .set({
      status: "active",
      lastStripeEventId: event.id,
      updatedAt: new Date().toISOString(),
    })
    .commit();
}

async function handleInvoicePaymentFailed(event: Stripe.Event) {
  if (!sanityWriteClient) return;
  const invoice = event.data.object as Stripe.Invoice;

  const subRef = invoice.parent?.subscription_details?.subscription;
  const subscriptionId =
    typeof subRef === "string" ? subRef : (subRef as Stripe.Subscription | undefined)?.id ?? null;
  if (!subscriptionId) return;

  const doc = await findSubscriptionDoc(subscriptionId);
  if (!doc) return;

  if (doc.lastStripeEventId === event.id) {
    console.info(
      `Stripe webhook: invoice.payment_failed event ${event.id} already ` +
        "processed — skipping duplicate delivery.",
    );
    return;
  }

  await sanityWriteClient
    .patch(doc._id)
    .set({
      status: "past_due",
      lastStripeEventId: event.id,
      updatedAt: new Date().toISOString(),
    })
    .commit();
}

// ════════════════════════════════════════════════════════════════════════
// Legacy shop handlers (WP7 — unchanged)
// ════════════════════════════════════════════════════════════════════════

async function handleShopCheckoutCompleted(
  session: Stripe.Checkout.Session,
) {
  if (!stripe) return;

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id);

  const items = await Promise.all(
    lineItems.data.map(async (lineItem) => {
      const stripePriceId = lineItem.price?.id ?? "";
      const product = stripePriceId
        ? await getProductByStripePriceId(stripePriceId)
        : null;
      return {
        _key: crypto.randomUUID(),
        _type: "orderLineItem",
        ...(product
          ? { productRef: { _type: "reference", _ref: product._id } }
          : {}),
        title: lineItem.description || "",
        quantity: lineItem.quantity ?? 1,
        stripePriceId,
      };
    }),
  );

  const orderDoc = {
    _type: "order",
    stripeCheckoutSessionId: session.id,
    stripeCustomerId:
      typeof session.customer === "string" ? session.customer : undefined,
    stripeSubscriptionId:
      typeof session.subscription === "string"
        ? session.subscription
        : undefined,
    mode: session.mode,
    customerEmail: session.customer_details?.email || undefined,
    items,
    amountTotal: session.amount_total ?? undefined,
    currency: session.currency ?? undefined,
    status: "paid" as const,
    placedAt: new Date().toISOString(),
  };

  if (sanityWriteClient) {
    await sanityWriteClient.create(orderDoc);
  } else {
    console.warn(
      "Stripe webhook: checkout.session.completed received but SANITY_API_WRITE_TOKEN " +
        "isn't set — order not recorded in Sanity (Stripe's own Dashboard still has it).",
      { stripeCheckoutSessionId: session.id },
    );
  }

  const toEmail = session.customer_details?.email;
  const fromEmail = process.env.SHOP_ORDER_FROM_EMAIL;
  if (toEmail && fromEmail) {
    const lines = items
      .map((item) => `- ${item.title} x${item.quantity}`)
      .join("\n");
    const result = await sendEmail({
      to: toEmail,
      from: fromEmail,
      subject: "Your Moral Tree Media order",
      text: `Thanks for your order!\n\n${lines}\n\nA member of our team will follow up if there's anything else you need.`,
    });
    if (!result.ok) {
      console.error("Order confirmation email failed to send:", result.error);
    }
  } else if (toEmail) {
    console.warn(
      "Stripe webhook: order confirmation email skipped — SHOP_ORDER_FROM_EMAIL/" +
        "RESEND_API_KEY not fully configured. See .env.example.",
    );
  }
}

async function handleLegacySubscriptionDeleted(
  subscription: Stripe.Subscription,
) {
  if (!sanityWriteClient) {
    console.warn(
      "Stripe webhook: customer.subscription.deleted received but SANITY_API_WRITE_TOKEN " +
        "isn't set — order status not updated.",
      { subscriptionId: subscription.id },
    );
    return;
  }

  const order = await sanityWriteClient.fetch<{ _id: string } | null>(
    `*[_type == "order" && stripeSubscriptionId == $id][0] { _id }`,
    { id: subscription.id },
  );
  if (!order) return;

  await sanityWriteClient
    .patch(order._id)
    .set({ status: "cancelled" })
    .commit();
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  if (!stripe || !sanityWriteClient) {
    if (!sanityWriteClient) {
      console.warn(
        "Stripe webhook: charge.refunded received but SANITY_API_WRITE_TOKEN isn't set — " +
          "order status not updated.",
        { chargeId: charge.id },
      );
    }
    return;
  }

  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  // Orders are keyed on Checkout Session ID, not Payment Intent ID — look
  // the session back up from Stripe (a Checkout Session's payment_intent
  // is unique to it) rather than adding a second ID field to the schema
  // just for this lookup.
  const sessions = await stripe.checkout.sessions.list({
    payment_intent: paymentIntentId,
    limit: 1,
  });
  const session = sessions.data[0];
  if (!session) return;

  const order = await sanityWriteClient.fetch<{ _id: string } | null>(
    `*[_type == "order" && stripeCheckoutSessionId == $id][0] { _id }`,
    { id: session.id },
  );
  if (!order) return;

  await sanityWriteClient.patch(order._id).set({ status: "refunded" }).commit();
}
