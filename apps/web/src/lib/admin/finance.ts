/**
 * Pure finance reporting rules shared by the server snapshot and dashboard.
 * No database, provider or environment access here.
 */
export type Period = "today" | "week" | "month" | "lifetime";
export interface Coverage {
  status: "complete" | "partial";
  reasons: string[];
}

// Stripe's own minor-unit rules (docs.stripe.com/currencies), not guessed from ISO alone.
const ZERO_DECIMAL = new Set(
  "bif clp djf gnf jpy kmf krw mga pyg rwf ugx vnd vuv xaf xof xpf".split(" "),
);
const THREE_DECIMAL = new Set("bhd jod kwd omr tnd".split(" "));
export function minorExponent(currency: string) {
  const code = currency.toLowerCase();
  return ZERO_DECIMAL.has(code) ? 0 : THREE_DECIMAL.has(code) ? 3 : 2;
}

/** Formats one currency's integer minor units. Never combines currencies. */
export function formatMinor(amountMinor: number, currency: string) {
  const exponent = minorExponent(currency);
  const major = amountMinor / 10 ** exponent;
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: exponent,
      maximumFractionDigits: exponent,
    }).format(major);
  } catch {
    return `${major.toFixed(exponent)} ${currency.toUpperCase()}`;
  }
}

/** pg returns bigint/numeric as strings; reject anything that is not an exact safe integer. */
export function toMinor(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  const rounded = Math.round(n);
  if (!Number.isFinite(n) || !Number.isSafeInteger(rounded))
    throw new Error("Amount outside reportable range");
  return rounded;
}

/**
 * A window is complete only when every stored successful-payment receipt in
 * it has a ledger amount and no provider object in it failed to record.
 * Receipts older than ledger coverage are reported separately from
 * post-coverage anomalies.
 */
export function windowCoverage(input: {
  preCoverageReceipts: number;
  unmatchedReceipts: number;
  gaps: number;
}): Coverage {
  const reasons: string[] = [];
  if (input.preCoverageReceipts > 0)
    reasons.push(
      `${input.preCoverageReceipts} successful-payment receipt(s) predate ledger coverage; their amounts were never recorded.`,
    );
  if (input.unmatchedReceipts > 0)
    reasons.push(
      `${input.unmatchedReceipts} successful-payment receipt(s) since coverage began have no ledger amount.`,
    );
  if (input.gaps > 0)
    reasons.push(
      `${input.gaps} provider object(s) could not be recorded completely.`,
    );
  return { status: reasons.length ? "partial" : "complete", reasons };
}

export function mrrStatus(
  paying: number,
  withContract: number,
): "available" | "partial" | "unavailable" {
  if (paying === withContract) return "available";
  return withContract > 0 ? "partial" : "unavailable";
}

/**
 * The most recent complete UTC calendar month fully inside history coverage.
 * History must exist at the month's opening instant to know the opening cohort.
 */
export function churnMonth(
  now: Date,
  historyStart: Date,
):
  | { start: Date; end: Date }
  | { firstMeasurable: Date; firstAvailableAt: Date } {
  const monthStart = (d: Date, offset = 0) =>
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));
  const end = monthStart(now);
  const start = monthStart(now, -1);
  const first =
    historyStart.getTime() === monthStart(historyStart).getTime()
      ? monthStart(historyStart)
      : monthStart(historyStart, 1);
  if (start.getTime() >= first.getTime()) return { start, end };
  return { firstMeasurable: first, firstAvailableAt: monthStart(first, 1) };
}

export function rate(numerator: number, denominator: number): number | null {
  return denominator > 0
    ? Math.round((numerator / denominator) * 1000) / 10
    : null;
}
