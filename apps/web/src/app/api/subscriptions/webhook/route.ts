import { billingStripe } from "@/lib/subscriptions/config";
import { processSubscriptionEvent } from "@/lib/subscriptions/webhook";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret)
    return Response.json({ error: "Webhook not configured" }, { status: 503 });
  let stripe;
  try {
    stripe = billingStripe();
  } catch {
    return Response.json(
      { error: "Test billing not configured" },
      { status: 503 },
    );
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature)
    return Response.json({ error: "Signature required" }, { status: 400 });
  const body = await request.text();
  if (body.length > 1024 * 1024)
    return Response.json({ error: "Payload too large" }, { status: 413 });
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, secret);
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (event.livemode)
    return Response.json({ error: "Live events forbidden" }, { status: 400 });
  try {
    await processSubscriptionEvent(event);
  } catch {
    console.error("Subscription webhook processing failed", {
      eventId: event.id,
      type: event.type,
    });
    return Response.json({ error: "Retry required" }, { status: 503 });
  }
  return Response.json({ received: true });
}
