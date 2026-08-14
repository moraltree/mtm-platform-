import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { isStripeConfigured, stripe } from "@/lib/stripe";
import { sanityWriteClient } from "@/lib/sanity/writeClient";
import { getProductByStripePriceId } from "@/lib/sanity/queries";
import { sendEmail } from "@/lib/email";

/**
 * Stripe webhook endpoint — the one place this codebase reacts to events
 * Stripe itself considers authoritative (payment success, subscription
 * cancellation, refunds). Writes `order` documents via the
 * write-authenticated Sanity client (lib/sanity/writeClient.ts) and sends
 * a best-effort confirmation email (lib/email.ts). Inert (503) unless
 * both STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are set — see
 * .env.example. Order-writing additionally degrades to a console warning
 * (event still acknowledged) if SANITY_API_WRITE_TOKEN isn't set, so a
 * partially-configured deployment doesn't cause Stripe to retry forever.
 */

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: Request) {
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
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;
      case "charge.refunded":
        await handleChargeRefunded(event.data.object);
        break;
      default:
        // Every other event type is intentionally ignored — Stripe sends
        // far more event types than this shop currently acts on.
        break;
    }
  } catch (error) {
    // Logged, not rethrown: a 5xx here makes Stripe retry the same event
    // repeatedly, which won't fix a handler bug and just adds noise. The
    // event is acknowledged either way; follow-up happens from the logs
    // (and, once configured, Sanity's Orders list / Stripe's own
    // Dashboard remain the authoritative records regardless).
    console.error(`Stripe webhook handler failed for ${event.type}:`, error);
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
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

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
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
