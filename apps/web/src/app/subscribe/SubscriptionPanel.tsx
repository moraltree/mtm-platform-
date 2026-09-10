import Link from "next/link";
import { currentAccount } from "@/lib/subscriptions/auth";
import { accessFor } from "@/lib/subscriptions/access";
import {
  login,
  logout,
  startCheckout,
  openPortal,
  cancelTrial,
} from "./actions";
import { billingStripe, checkedPrice } from "@/lib/subscriptions/config";
import { formatPrice } from "@/lib/format";
const notices: Record<string, string> = {
  processing:
    "Stripe has received your request. Access updates after payment is confirmed. Refresh this page shortly.",
  cancelled:
    "Checkout was cancelled. You can choose a plan whenever you are ready.",
  email:
    "If this address has an account, a sign-in email is on its way. New here? Register using the free access link below.",
  unavailable:
    "This service is not fully configured or is temporarily unavailable. Please try again shortly.",
  "invalid-link":
    "This sign-in link is invalid, expired, or already used. Request a new email below.",
  "checkout-error":
    "Checkout could not open. If you already have a subscription, use Manage billing. Otherwise retry your previous selection or contact us.",
  retry:
    "Your earlier checkout has expired or been closed. Please choose your plan again.",
};
export async function SubscriptionPanel({ notice }: { notice?: string }) {
  const account = await currentAccount();
  const access = account ? await accessFor(account.id) : "none";
  let prices: { monthly: string; annual: string } | null = null;
  try {
    const stripe = billingStripe();
    const [monthly, annual] = await Promise.all([
      checkedPrice(stripe, "monthly"),
      checkedPrice(stripe, "annual"),
    ]);
    prices = {
      monthly: formatPrice(monthly.unit_amount!, monthly.currency),
      annual: formatPrice(annual.unit_amount!, annual.currency),
    };
  } catch {
    /* Honest inactive state until test prices are configured. */
  }
  return (
    <section
      style={{ maxWidth: "48rem", margin: "3rem auto", padding: "1rem" }}
      aria-labelledby="billing-title"
    >
      <h2 id="billing-title">Your subscription</h2>
      <p>
        <strong>Test mode — use Stripe test payment details only.</strong>
      </p>
      {notice && notices[notice] && <p role="status">{notices[notice]}</p>}
      {account ? (
        <>
          <p>
            Signed in as {account.email}. Access:{" "}
            {access === "paid"
              ? "full library"
              : access === "trial"
                ? "free story selection"
                : "no active access"}
            .
          </p>
          {account.trial_end && (
            <p>
              Free access ends{" "}
              {account.trial_end.toISOString().replace("T", " ").slice(0, 16)}{" "}
              (UTC).
            </p>
          )}
          {access !== "none" && (
            <p>
              <Link href="/library">Open your library</Link>
            </p>
          )}
          {prices ? (
            <form action={startCheckout}>
              <label htmlFor="subscription-plan">Choose a plan</label>{" "}
              <select id="subscription-plan" name="plan">
                <option value="monthly">
                  Monthly — {prices.monthly} per month
                </option>
                <option value="annual">
                  Annual — {prices.annual} per year
                </option>
              </select>{" "}
              <button name="kind" value="paid" type="submit">
                Subscribe now
              </button>
              {account.card_required &&
                account.trial_status === "offered" &&
                account.trial_days > 0 && (
                  <>
                    <p>
                      {account.trial_days} calendar days of free access after
                      card setup.{" "}
                      {account.auto_convert
                        ? "Your selected plan will start charging automatically when free access ends unless you cancel first."
                        : "No automatic paid conversion. Subscribe whenever you are ready."}
                    </p>
                    <button name="kind" value="trial" type="submit">
                      Set up card and start free access
                    </button>
                  </>
                )}
            </form>
          ) : (
            <p>Subscription prices are not configured yet.</p>
          )}
          {account.customer_id && (
            <form action={openPortal}>
              <button type="submit">Manage billing</button>
            </form>
          )}
          {["active", "offered"].includes(account.trial_status ?? "") && (
            <form action={cancelTrial}>
              <button type="submit">Cancel free access</button>
            </form>
          )}
          <form action={logout}>
            <button type="submit">Sign out</button>
          </form>
        </>
      ) : (
        <>
          <form action={login}>
            <label htmlFor="member-email">Account email</label>{" "}
            <input
              id="member-email"
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
            />{" "}
            <button type="submit">Email a sign-in link</button>
          </form>
          <p>
            <Link href="/free30">
              Register for up to 30 days of free access
            </Link>
          </p>
        </>
      )}
    </section>
  );
}
