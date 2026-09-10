"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  currentAccount,
  requestLogin,
  requireAccount,
  sessionCookie,
  hashToken,
} from "@/lib/subscriptions/auth";
import { checkout, portal } from "@/lib/subscriptions/billing";
import { database, transaction, recordEvent } from "@/lib/subscriptions/db";
import { billingStripe } from "@/lib/subscriptions/config";

export async function login(form: FormData) {
  try {
    await requestLogin(String(form.get("email") ?? ""));
  } catch {
    redirect("/subscribe?notice=unavailable");
  }
  redirect("/subscribe?notice=email");
}
export async function startCheckout(form: FormData) {
  const account = await requireAccount();
  let url: string;
  try {
    url = await checkout(
      account.id,
      form.get("plan"),
      form.get("kind") === "trial" ? "trial" : "paid",
    );
  } catch {
    redirect("/subscribe?notice=checkout-error");
  }
  redirect(url);
}
export async function openPortal() {
  const account = await requireAccount();
  let url: string;
  try {
    url = await portal(account.id);
  } catch {
    redirect("/subscribe?notice=unavailable");
  }
  redirect(url);
}
export async function cancelTrial() {
  const account = await requireAccount();
  await transaction(async (db) => {
    await db.query("SELECT id FROM mtm_accounts WHERE id=$1 FOR UPDATE", [
      account.id,
    ]);
    const subs = await db.query(
      "SELECT stripe_id FROM mtm_subscriptions WHERE user_id=$1 AND status='trialing'",
      [account.id],
    );
    for (const sub of subs.rows) {
      const stripe = billingStripe();
      const latest = await stripe.subscriptions.retrieve(sub.stripe_id);
      if (latest.status === "trialing")
        await stripe.subscriptions.cancel(sub.stripe_id);
    }
    const changed = await db.query(
      "UPDATE mtm_accounts SET trial_status='cancelled' WHERE id=$1 AND trial_status IN ('offered','active') RETURNING id",
      [account.id],
    );
    if (changed.rowCount)
      await recordEvent(
        db,
        account.id,
        `trial-cancelled:${account.id}`,
        "TRIAL_CANCELLED",
      );
  });
  redirect("/subscribe");
}
export async function logout() {
  if (await currentAccount()) {
    const token = (await cookies()).get(sessionCookie)?.value;
    if (token)
      await database().query("DELETE FROM mtm_sessions WHERE token_hash=$1", [
        hashToken(token),
      ]);
  }
  (await cookies()).delete(sessionCookie);
  redirect("/subscribe");
}
