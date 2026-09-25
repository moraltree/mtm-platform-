import type { Overview } from "@/lib/admin/overview";
import type { RevenueWindow } from "@/lib/admin/financeSnapshot";
import { formatMinor, type Period } from "@/lib/admin/finance";
import { BarTrend } from "./charts";
import {
  CoverageTag,
  Delta,
  InfoTip,
  number,
  SectionHeading,
  StatusPill,
  timestamp,
  Unavailable,
} from "./components";
import styles from "./admin.module.css";

const revenueLabels: Record<Period, string> = {
  today: "Revenue today",
  week: "Revenue this week",
  month: "Revenue this month",
  lifetime: "Lifetime recorded revenue",
};

function RevenueCard({ window: w }: { window: RevenueWindow }) {
  const complete = w.coverage.status === "complete";
  return (
    <article className={styles.kpi}>
      <div className={styles.kpiHead}>
        <h3>{revenueLabels[w.period]}</h3>
        <CoverageTag complete={complete} />
      </div>
      {w.currencies.length ? (
        <ul className={styles.currencyList}>
          {w.currencies.map((c) => (
            <li key={c.currency}>
              <p className={styles.kpiValue}>
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

function PaymentStatus({ overview: d }: { overview: Overview }) {
  const i = d.insights;
  return (
    <section className={styles.panel} aria-labelledby="payment-status">
      <SectionHeading
        id="payment-status"
        title="Payment status"
        meta="Billing events · receipt time"
      />
      <dl className={styles.miniStats}>
        <div>
          <dt>Successful payments · 7 days</dt>
          <dd>{number(i.comparisons.payments.d7.current)}</dd>
          <Delta
            comparison={i.comparisons.payments.d7}
            period="7 days"
            upIsGood
          />
        </div>
        <div>
          <dt>Failed payment attempts · 7 days</dt>
          <dd>{number(i.comparisons.failed_payments.d7.current)}</dd>
          <Delta
            comparison={i.comparisons.failed_payments.d7}
            period="7 days"
            upIsGood={false}
          />
        </div>
        <div>
          <dt>Failed payment attempts · all time</dt>
          <dd>{number(d.health.failedPayments)}</dd>
        </div>
      </dl>
      <p className={styles.detail}>
        Successful payments count every recorded paid invoice, including
        zero-value trial invoices; failed attempts count each Stripe retry
        separately.
      </p>
      <h3 className={styles.subHeading}>Recorded successful payment events</h3>
      <p className={styles.detail}>
        Event receipt time, not settlement time. Deduplicated by Stripe event
        ID; not an invoice ledger.
      </p>
      <dl className={styles.paymentCounts}>
        {(
          [
            ["Today", d.payments.today],
            ["This week", d.payments.week],
            ["This month", d.payments.month],
            ["All time", d.payments.lifetime],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{number(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function FinanceView({ overview: d }: { overview: Overview }) {
  const f = d.finance;
  const c = d.counts;
  if (!f)
    return (
      <>
        <section aria-labelledby="revenue-heading">
          <SectionHeading
            id="revenue-heading"
            title="Revenue & plans"
            meta="UTC · week starts Monday"
          />
          <div className={styles.kpiGrid}>
            {[
              "Revenue today",
              "Revenue this week",
              "Revenue this month",
              "Lifetime subscription revenue",
            ].map((label) => (
              <Unavailable
                key={label}
                label={label}
                reason="Payment events do not store amounts or currencies. Counts cannot establish revenue."
              />
            ))}
          </div>
          <div className={styles.planStrip}>
            <div>
              <span>Monthly paid accounts</span>
              <strong>{number(c.monthly)}</strong>
            </div>
            <div>
              <span>Annual paid accounts</span>
              <strong>{number(c.annual)}</strong>
            </div>
            <div>
              <span>Monthly recurring revenue</span>
              <strong className={styles.smallValue}>Not yet available</strong>
              <small>
                Contract amounts, currencies and discounts are not stored.
              </small>
            </div>
          </div>
        </section>
        <PaymentStatus overview={d} />
      </>
    );
  const sandbox = f.mode.testEntries > 0 && f.mode.liveEntries === 0;
  const m = f.mrr;
  return (
    <>
      <section aria-labelledby="revenue-heading">
        <SectionHeading
          id="revenue-heading"
          title="Revenue"
          meta="UTC · week starts Monday"
        />
        <p className={styles.lede}>
          Ledger coverage began {timestamp(f.coverage.ledgerStart)} UTC
          {f.coverage.backfilled ? " (validated backfill recorded)" : ""}. Net =
          successful invoice payments − succeeded refunds − lost disputes, by
          provider occurrence time. Gross amounts include any tax and are before
          Stripe fees.
          {sandbox &&
            " All recorded amounts are Stripe TEST-mode sandbox data."}
        </p>
        <div className={styles.kpiGrid}>
          {f.revenue.map((w) => (
            <RevenueCard key={w.period} window={w} />
          ))}
        </div>
      </section>

      <div className={styles.planStrip}>
        <div>
          <span>Monthly paid accounts</span>
          <strong>{number(c.monthly)}</strong>
        </div>
        <div>
          <span>Annual paid accounts</span>
          <strong>{number(c.annual)}</strong>
        </div>
        <div>
          <span className={styles.stripHead}>
            Monthly recurring revenue
            <InfoTip label="Monthly recurring revenue">
              Paying subscriptions (active, future paid-through, unblocked):
              list price × quantity, annual ÷ 12, excluding tax, per currency.
              Discounted or unpriced subscriptions are excluded and make MRR
              partial.
            </InfoTip>
          </span>
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
              {m.currencies.map((cur) => (
                <strong key={cur.currency} className={styles.smallValue}>
                  {formatMinor(cur.mrrMinor, cur.currency)}{" "}
                  {cur.currency.toUpperCase()}
                </strong>
              ))}
              <small>
                {m.status === "partial"
                  ? `Partial: ${number(m.priced)} of ${number(m.paying)} paying subscriptions have a recorded, undiscounted contract. `
                  : `All ${number(m.paying)} paying subscriptions. `}
                Annual ÷ 12, list price × quantity, excludes tax.
                {m.currencies.some((cur) => cur.cancelingMinor > 0) &&
                  ` Includes ${m.currencies
                    .filter((cur) => cur.cancelingMinor > 0)
                    .map((cur) => formatMinor(cur.cancelingMinor, cur.currency))
                    .join(", ")} scheduled to cancel.`}
              </small>
            </>
          )}
        </div>
      </div>

      <FinanceDetail overview={d} />
    </>
  );
}

/** Daily gross revenue, plan attribution and payment status (Phase 2 ledger + Phase 1 events). */
export function FinanceDetail({ overview: d }: { overview: Overview }) {
  const f = d.finance;
  const i = d.insights;
  if (!f) return <PaymentStatus overview={d} />;
  return (
    <>
      <section aria-labelledby="revenue-trend">
        <SectionHeading
          id="revenue-trend"
          title="Daily gross revenue"
          meta="Last 30 days · one chart per currency"
        />
        {i.revenueSeries?.length ? (
          <div className={styles.chartGrid}>
            {i.revenueSeries.map((series) => (
              <BarTrend
                key={series.currency}
                title={`${series.currency.toUpperCase()} gross collected`}
                unit="collected"
                format={(v) => formatMinor(v, series.currency)}
                points={series.days.map((day) => ({
                  day: day.day,
                  value: day.grossMinor,
                  partial: day.partial,
                  uncovered: day.coverage === "none",
                }))}
                note={
                  series.days.some((day) => day.coverage !== "full")
                    ? "Shaded days precede ledger coverage and are not shown as zero."
                    : undefined
                }
              />
            ))}
          </div>
        ) : (
          <p className={styles.empty}>
            No ledger payments in the last 30 days.
          </p>
        )}
      </section>

      <div className={styles.split}>
        <section className={styles.panel} aria-labelledby="plan-revenue">
          <SectionHeading id="plan-revenue" title="Recorded revenue by plan" />
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
          {f.mode.liveEntries > 0 && (
            <StatusPill tone="critical">
              Live-mode entries present — review immediately
            </StatusPill>
          )}
        </section>
        <PaymentStatus overview={d} />
      </div>
    </>
  );
}
