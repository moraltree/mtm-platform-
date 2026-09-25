/**
 * Pure Phase 4 rules: attribution allowlisting, small-group suppression and
 * data-coverage evaluation. No database, provider or environment access.
 */
import { COUNTRIES } from "@/lib/countries";

/** Groups smaller than this are merged, so no row describes an individual. */
export const MIN_GROUP = 5;

/** Campaign keys are server-validated at registration; display only well-formed ones. */
const CAMPAIGN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
export function campaignKey(value: unknown): string | null {
  return typeof value === "string" && CAMPAIGN.test(value) ? value : null;
}

export function countryName(code: unknown): string | null {
  if (typeof code !== "string" || !/^[A-Z]{2}$/.test(code)) return null;
  return COUNTRIES.find((c) => c.code === code)?.name ?? null;
}

export interface Suppressible {
  key: string;
  count: number;
}
/**
 * Keeps rows with at least MIN_GROUP members and folds the rest into one
 * "other" row. If the folded group itself is smaller than MIN_GROUP it is
 * still reported (as a bucket, never a single identifiable row).
 */
export function suppress<T extends Suppressible>(
  rows: T[],
  merge: (small: T[]) => T,
): { rows: T[]; suppressed: number } {
  const kept = rows.filter((r) => r.count >= MIN_GROUP);
  const small = rows.filter((r) => r.count < MIN_GROUP);
  return {
    rows: small.length ? [...kept, merge(small)] : kept,
    suppressed: small.length,
  };
}

export type CoverageStatus = "available" | "partial" | "unavailable";
export interface CoverageDomain {
  id: string;
  title: string;
  status: CoverageStatus;
  since: string | null;
  source: string;
  detail: string;
}
export interface Inventory {
  accounts: number;
  accounts_since: Date | null;
  with_campaign: number;
  with_country: number;
  billing_events: number;
  billing_since: Date | null;
  receipts: number;
  ledger_entries: number;
  live_entries: number;
  unclassified_payments: number;
  failures: number;
  history_rows: number;
  subscriptions: number;
  active_without_contract: number;
  listening_events: number;
  published_stories: number;
  stories_with_world: number;
}
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const pct = (part: number, whole: number) =>
  whole ? `${Math.round((part / whole) * 100)}%` : "0%";

/** Every analytical domain with an honest status, source and reason. */
export function evaluateCoverage(
  inv: Inventory,
  starts: Map<string, Date>,
): CoverageDomain[] {
  const ledger = starts.get("payment_ledger");
  const history = starts.get("subscription_history");
  const contracts = starts.get("subscription_contracts");
  const reasons = starts.get("billing_reason");
  const failures = starts.get("payment_failures");
  const listening = starts.get("listening");
  const preLedger = !!(
    ledger &&
    inv.billing_since &&
    inv.billing_since.getTime() < ledger.getTime()
  );
  return [
    {
      id: "accounts",
      title: "Accounts & registrations",
      status: "available",
      since: iso(inv.accounts_since),
      source: "mtm_accounts (verified sign-ups)",
      detail: `${inv.accounts} accounts recorded since the subscription system began.`,
    },
    {
      id: "billing",
      title: "Trials, conversions & cancellations",
      status: "available",
      since: iso(inv.billing_since),
      source: "mtm_billing_events (signed webhooks, receipt time)",
      detail:
        "Durable lifecycle events. Depend on webhook delivery; failed deliveries are not persisted.",
    },
    {
      id: "revenue",
      title: "Revenue ledger",
      status: !ledger ? "unavailable" : preLedger ? "partial" : "available",
      since: iso(ledger),
      source:
        "mtm_ledger_entries (retrieved Stripe invoices, refunds, disputes)",
      detail: !ledger
        ? "Ledger migration not installed."
        : preLedger
          ? "Payments received before the ledger began have counts but no amounts; no validated backfill exists."
          : "Every recorded payment receipt has a ledger amount.",
    },
    {
      id: "new-renewal",
      title: "New vs renewal revenue",
      status: !reasons
        ? "unavailable"
        : inv.unclassified_payments > 0
          ? "partial"
          : "available",
      since: iso(reasons),
      source: "Stripe invoice billing_reason on ledger payments",
      detail:
        inv.unclassified_payments > 0
          ? `${inv.unclassified_payments} earlier ledger payment(s) are unclassified.`
          : "All ledger payments are classified.",
    },
    {
      id: "failed-value",
      title: "Failed-payment value",
      status: failures ? "available" : "unavailable",
      since: iso(failures),
      source: "mtm_payment_failures (invoice amount due at failure)",
      detail: failures
        ? "Failures before this date are counted but have no recorded value."
        : "Migration 003 not installed.",
    },
    {
      id: "mrr",
      title: "Monthly recurring revenue",
      status: !contracts
        ? "unavailable"
        : inv.active_without_contract > 0
          ? "partial"
          : "available",
      since: iso(contracts),
      source: "Contract snapshot on mtm_subscriptions",
      detail:
        inv.active_without_contract > 0
          ? `${inv.active_without_contract} active subscription(s) lack a contract amount until their next webhook.`
          : "Every active subscription has a contract snapshot.",
    },
    {
      id: "history",
      title: "Churn, net movement & retention curves",
      status: history ? "partial" : "unavailable",
      since: iso(history),
      source: "mtm_subscription_history (baseline + transitions)",
      detail: history
        ? "Measurable only for periods that start after history began; earlier periods are never reconstructed."
        : "History migration not installed.",
    },
    {
      id: "cohorts",
      title: "Registration & trial cohorts",
      status: "available",
      since: iso(inv.accounts_since),
      source: "Accounts plus durable billing events; retention is as of today",
      detail:
        "Outcomes to date per cohort. Month-by-month retention curves need subscription history.",
    },
    {
      id: "campaigns",
      title: "Campaign attribution",
      status: inv.with_campaign
        ? inv.with_campaign < inv.accounts
          ? "partial"
          : "available"
        : "unavailable",
      since: iso(inv.accounts_since),
      source: "Server-validated campaign ID stored at registration",
      detail: `${pct(inv.with_campaign, inv.accounts)} of accounts carry a campaign ID. Partner and landing source are not validated and are not reported. Visits are not recorded.`,
    },
    {
      id: "geography",
      title: "Geography",
      status: inv.with_country ? "partial" : "unavailable",
      since: iso(inv.accounts_since),
      source: "Optional, self-declared registration country (unverified)",
      detail: `${pct(inv.with_country, inv.accounts)} of accounts declared a country. Never inferred from email, currency, campaign or IP address.`,
    },
    {
      id: "listening",
      title: "Listening & content",
      status: listening ? "available" : "unavailable",
      since: iso(listening),
      source: "mtm_listening_events (schema ready, telemetry not enabled)",
      detail: listening
        ? `${inv.listening_events} listening events recorded.`
        : `Awaiting approved listening telemetry. ${inv.stories_with_world} of ${inv.published_stories} published stories have a Story World assigned.`,
    },
    {
      id: "webhook-failures",
      title: "Webhook delivery failures",
      status: "unavailable",
      since: null,
      source: "Not persisted",
      detail:
        "Failed processing rolls back with the receipt, so failures are not stored. Never shown as zero.",
    },
    {
      id: "environment",
      title: "Environment",
      status: inv.live_entries > 0 ? "partial" : "available",
      since: null,
      source: "Ledger livemode flag",
      detail:
        inv.live_entries > 0
          ? `${inv.live_entries} live-mode ledger entries present alongside test data — review immediately.`
          : "All recorded money is Stripe TEST-mode sandbox data.",
    },
  ];
}
