import type { Finance, RevenueWindow } from "@/lib/admin/financeSnapshot";
import { formatMinor, type Period } from "@/lib/admin/finance";
import styles from "./admin.module.css";

const number = (value: number) => new Intl.NumberFormat("en-GB").format(value);
const date = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
const monthName = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
const periodLabels: Record<Period, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  lifetime: "Recorded lifetime",
};
const revenueLabels: Record<Period, string> = {
  today: "Revenue today",
  week: "Revenue this week",
  month: "Revenue this month",
  lifetime: "Lifetime recorded revenue",
};

function CoverageTag({ complete }: { complete: boolean }) {
  return (
    <span className={complete ? styles.tagComplete : styles.tagPartial}>
      {complete ? "Complete coverage" : "Partial coverage"}
    </span>
  );
}

function RevenueCard({ window: w }: { window: RevenueWindow }) {
  const complete = w.coverage.status === "complete";
  return (
    <article className={styles.metric}>
      <h3>{revenueLabels[w.period]}</h3>
      <CoverageTag complete={complete} />
      {w.currencies.length ? (
        <ul className={styles.currencyList}>
          {w.currencies.map((c) => (
            <li key={c.currency}>
              <p className={styles.value}>
                {formatMinor(c.netMinor, c.currency)}
              </p>
              <p className={styles.detail}>
                {c.currency.toUpperCase()} net · gross{" "}
                {formatMinor(c.grossMinor, c.currency)} · {number(c.payments)}{" "}
                payment{c.payments === 1 ? "" : "s"}
                {c.refundedMinor > 0 &&
                  ` · refunds ${formatMinor(c.refundedMinor, c.currency)}`}
                {c.disputesLostMinor > 0 &&
                  ` · lost disputes ${formatMinor(c.disputesLostMinor, c.currency)}`}
                {c.pendingRefunds > 0 &&
                  ` · ${number(c.pendingRefunds)} refund(s) pending`}
                {c.openDisputes > 0 &&
                  ` · ${number(c.openDisputes)} dispute(s) open`}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.missing}>
          {complete ? "No recorded payments" : "No amounts recorded"}
        </p>
      )}
      {w.currencies.length > 1 && (
        <p className={styles.detail}>
          Shown per currency. No consolidated total: no authoritative exchange
          rate is stored.
        </p>
      )}
      {w.coverage.reasons.map((reason) => (
        <p key={reason} className={styles.detail}>
          {reason}
        </p>
      ))}
    </article>
  );
}

export function FinanceRevenue({
  finance: f,
  monthly,
  annual,
}: {
  finance: Finance;
  monthly: number;
  annual: number;
}) {
  const sandbox = f.mode.testEntries > 0 && f.mode.liveEntries === 0;
  const m = f.mrr;
  return (
    <>
      <p className={styles.detail}>
        Ledger coverage began {date(f.coverage.ledgerStart)} UTC
        {f.coverage.backfilled ? " (validated backfill recorded)" : ""}. Net =
        successful invoice payments − succeeded refunds − lost disputes, by
        provider occurrence time. Gross amounts include any tax and are before
        Stripe fees.
        {sandbox && " All recorded amounts are Stripe TEST-mode sandbox data."}
      </p>
      <div className={styles.grid4}>
        {f.revenue.map((w) => (
          <RevenueCard key={w.period} window={w} />
        ))}
      </div>
      <div className={styles.planStrip}>
        <div>
          <span>Monthly paid accounts</span>
          <strong>{number(monthly)}</strong>
        </div>
        <div>
          <span>Annual paid accounts</span>
          <strong>{number(annual)}</strong>
        </div>
        <div>
          <span>Monthly recurring revenue</span>
          {m.paying === 0 ? (
            <>
              <strong className={styles.smallValue}>None</strong>
              <small>No active paid subscriptions.</small>
            </>
          ) : m.status === "unavailable" ? (
            <>
              <strong className={styles.smallValue}>Not yet available</strong>
              <small>
                None of the {number(m.paying)} paying subscriptions has a
                recorded contract amount yet; each gains one on its next
                subscription webhook.
              </small>
            </>
          ) : (
            <>
              {m.currencies.map((c) => (
                <strong key={c.currency} className={styles.smallValue}>
                  {formatMinor(c.mrrMinor, c.currency)}{" "}
                  {c.currency.toUpperCase()}
                </strong>
              ))}
              <small>
                {m.status === "partial"
                  ? `Partial: ${number(m.priced)} of ${number(m.paying)} paying subscriptions have a recorded, undiscounted contract. `
                  : `All ${number(m.paying)} paying subscriptions. `}
                Annual ÷ 12, list price × quantity, excludes tax.
                {m.currencies.some((c) => c.cancelingMinor > 0) &&
                  ` Includes ${m.currencies
                    .filter((c) => c.cancelingMinor > 0)
                    .map((c) => formatMinor(c.cancelingMinor, c.currency))
                    .join(", ")} scheduled to cancel.`}
              </small>
            </>
          )}
        </div>
      </div>
      <div className={styles.panel}>
        <h3>Recorded revenue by plan</h3>
        <p className={styles.detail}>
          Gross successful payments, attributed only when every priced invoice
          line maps to one configured plan. Refunds are not split by plan.
        </p>
        {f.plans.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Plan</th>
                  <th scope="col">Currency</th>
                  <th scope="col">This month</th>
                  <th scope="col">Recorded lifetime</th>
                </tr>
              </thead>
              <tbody>
                {f.plans.map((p) => (
                  <tr key={`${p.currency}-${p.plan}`}>
                    <th scope="row">
                      {p.plan === "unattributed"
                        ? "Unattributed"
                        : p.plan === "monthly"
                          ? "Monthly"
                          : "Annual"}
                    </th>
                    <td>{p.currency.toUpperCase()}</td>
                    <td>
                      {formatMinor(p.monthMinor, p.currency)} (
                      {number(p.monthPayments)})
                    </td>
                    <td>
                      {formatMinor(p.lifetimeMinor, p.currency)} (
                      {number(p.lifetimePayments)})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.empty}>No ledger payments recorded yet.</p>
        )}
      </div>
    </>
  );
}

export function FinanceLifecycle({ finance: f }: { finance: Finance }) {
  const rows: [string, (r: Finance["lifecycle"][number]) => string][] = [
    ["New paid subscriptions", (r) => number(r.newPaidSubscriptions)],
    ["New paid subscribers (first ever)", (r) => number(r.newPaidAccounts)],
    ["Returning paid subscribers", (r) => number(r.returningPaid)],
    ["Trial conversions", (r) => number(r.conversions)],
    ["Cancellations", (r) => number(r.cancellations)],
    [
      "Cancellations scheduled",
      (r) =>
        `${number(r.scheduledCancellations.count)}${r.scheduledCancellations.complete ? "" : " †"}`,
    ],
  ];
  const c = f.churn;
  return (
    <section id="lifecycle" aria-labelledby="lifecycle-heading">
      <div className={styles.sectionHeading}>
        <h2 id="lifecycle-heading">Subscriber movement</h2>
        <span>Recorded receipt time · UTC</span>
      </div>
      <div className={styles.twoColumns}>
        <div className={styles.panel}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Measure</th>
                  {f.lifecycle.map((r) => (
                    <th scope="col" key={r.period}>
                      {periodLabels[r.period]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, value]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    {f.lifecycle.map((r) => (
                      <td key={r.period}>{value(r)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.detail}>
            Paid and cancellation counts come from durable billing events.
            Returning = a paid subscription for an account that had an earlier
            one. † Scheduled cancellations are recorded only since subscription
            history began ({date(f.coverage.historyStart)} UTC); earlier windows
            are incomplete.
          </p>
        </div>
        <div className={styles.grid1}>
          <article className={styles.metric}>
            <h3>Paid subscriber churn</h3>
            {c.status === "available" ? (
              <>
                <p className={styles.value}>
                  {c.rate === null ? "—" : `${c.rate}%`}
                </p>
                <p className={styles.detail}>
                  {monthName(c.monthStart)}: {number(c.churned)} of{" "}
                  {number(c.opening)} accounts with paid access at the month’s
                  opening had none at its close.
                  {c.rate === null && " No opening paid subscribers."}
                </p>
              </>
            ) : (
              <>
                <p className={styles.missing}>Not yet available</p>
                <p className={styles.detail}>
                  Subscription history began {date(f.coverage.historyStart)}{" "}
                  UTC. The first complete month with a known opening cohort is{" "}
                  {monthName(c.firstMeasurableMonth)}, measurable from{" "}
                  {date(c.availableFrom)} UTC. Not reconstructed from current
                  state.
                </p>
              </>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}
