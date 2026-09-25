import type { Overview } from "@/lib/admin/overview";
import { UP_IS_GOOD } from "@/lib/admin/insights";
import { formatMinor } from "@/lib/admin/finance";
import { Spark, ShareBars } from "./charts";
import {
  CoverageTag,
  Delta,
  Kpi,
  number,
  percent,
  SectionHeading,
  StatusPill,
  timestamp,
} from "./components";
import { ActivityList } from "./ActivityList";
import { healthTone } from "./health";
import styles from "./admin.module.css";

/** One-screen executive summary: KPIs, trend tiles, health and latest activity. */
export function OverviewView({ overview: d }: { overview: Overview }) {
  const c = d.counts;
  const f = d.finance;
  const i = d.insights;
  const month = f?.revenue.find((w) => w.period === "month");
  const health = healthTone(d);
  return (
    <>
      <section aria-labelledby="kpi-heading">
        <SectionHeading
          id="kpi-heading"
          title="Subscribers today"
          meta="Unique accounts · live snapshot"
        />
        <div className={styles.kpiGrid}>
          <Kpi
            hero
            label="Active paid subscribers"
            value={number(c.paid)}
            detail="Unblocked accounts with active status and a future paid-through date."
            definition="Distinct unblocked accounts with at least one active subscription whose paid-through date is in the future. Scheduled cancellations keep access until that date."
          >
            <p className={styles.kpiSub}>
              New paid subscriptions, last 30 days:{" "}
              <strong>{number(i.comparisons.new_paid.d30.current)}</strong>
            </p>
            <Delta
              comparison={i.comparisons.new_paid.d30}
              period="30 days"
              upIsGood
            />
          </Kpi>
          <Kpi
            label="Active trial users"
            value={number(c.trials)}
            detail="Unblocked, unexpired platform trials without current paid access."
            definition="Accounts whose single platform trial is active and unexpired, without current paid access. Separate from Stripe's own 'trialing' status."
          >
            <Spark points={i.series.trial_starts} />
          </Kpi>
          <Kpi
            label="Trial-to-paid conversion"
            value={percent(d.conversionRate)}
            detail={
              d.conversionRate === null
                ? "Not yet available: no recorded trial starts."
                : `${number(c.converted)} of ${number(c.trials_started)} started trials converted.`
            }
            definition="Converted trials ÷ started trials, all time. Includes trials still running, so it is not a matured cohort rate — see Subscribers & conversion for the matured rate."
          />
          <Kpi
            label="Registered accounts"
            value={number(c.accounts)}
            definition="Every stored account, including blocked accounts and administrators."
          >
            <p className={styles.kpiSub}>
              New registrations, last 7 days:{" "}
              <strong>{number(i.comparisons.registrations.d7.current)}</strong>
            </p>
            <Delta
              comparison={i.comparisons.registrations.d7}
              period="7 days"
              upIsGood={UP_IS_GOOD.registrations}
            />
            <Spark points={i.series.registrations} />
          </Kpi>
        </div>
      </section>

      <div className={styles.split}>
        <section className={styles.panel} aria-labelledby="plans-heading">
          <SectionHeading id="plans-heading" title="Plans & movement" />
          <ShareBars
            caption="Paid accounts by plan"
            rows={[
              {
                label: "Monthly paid accounts",
                value: c.monthly,
                share: null,
              },
              { label: "Annual paid accounts", value: c.annual, share: null },
            ]}
          />
          <p className={styles.detail}>
            Accounts holding both plans appear in each row.
          </p>
          <dl className={styles.miniStats}>
            <div>
              <dt>Cancellations · 30 days</dt>
              <dd>{number(i.comparisons.cancellations.d30.current)}</dd>
              <Delta
                comparison={i.comparisons.cancellations.d30}
                period="30 days"
                upIsGood={false}
              />
            </div>
            <div>
              <dt>Successful payments · 30 days</dt>
              <dd>{number(i.comparisons.payments.d30.current)}</dd>
              <Delta
                comparison={i.comparisons.payments.d30}
                period="30 days"
                upIsGood
              />
            </div>
            <div>
              <dt>Failed payment attempts · 30 days</dt>
              <dd>{number(i.comparisons.failed_payments.d30.current)}</dd>
              <Delta
                comparison={i.comparisons.failed_payments.d30}
                period="30 days"
                upIsGood={false}
              />
            </div>
          </dl>
        </section>

        <section className={styles.panel} aria-labelledby="money-heading">
          <SectionHeading
            id="money-heading"
            title="Revenue"
            meta={<a href="/admin?view=finance">Finance detail →</a>}
          />
          {f && month ? (
            <>
              <div className={styles.moneyHead}>
                <span>Revenue this month (net)</span>
                <CoverageTag complete={month.coverage.status === "complete"} />
              </div>
              {month.currencies.length ? (
                <ul className={styles.moneyList}>
                  {month.currencies.map((cur) => (
                    <li key={cur.currency}>
                      <strong>{formatMinor(cur.netMinor, cur.currency)}</strong>
                      <span>
                        {cur.currency.toUpperCase()} · {number(cur.payments)}{" "}
                        payment{cur.payments === 1 ? "" : "s"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.missing}>
                  {month.coverage.status === "complete"
                    ? "No recorded payments"
                    : "No amounts recorded"}
                </p>
              )}
              {month.currencies.length > 1 && (
                <p className={styles.detail}>
                  Per currency; no consolidated total without an authoritative
                  exchange rate.
                </p>
              )}
              <div className={styles.moneyHead}>
                <span>Monthly recurring revenue</span>
                {f.mrr.status !== "available" && f.mrr.paying > 0 && (
                  <StatusPill tone="warning">
                    {f.mrr.status === "partial" ? "Partial" : "Unavailable"}
                  </StatusPill>
                )}
              </div>
              {f.mrr.paying === 0 ? (
                <p className={styles.detail}>No active paid subscriptions.</p>
              ) : f.mrr.currencies.length ? (
                <ul className={styles.moneyList}>
                  {f.mrr.currencies.map((m) => (
                    <li key={m.currency}>
                      <strong>{formatMinor(m.mrrMinor, m.currency)}</strong>
                      <span>{m.currency.toUpperCase()} MRR</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.detail}>
                  Not yet available: no paying subscription has a recorded
                  contract amount.
                </p>
              )}
              {f.mrr.status === "partial" && (
                <p className={styles.detail}>
                  Lower bound: {number(f.mrr.priced)} of {number(f.mrr.paying)}{" "}
                  paying subscriptions have a recorded contract.
                </p>
              )}
            </>
          ) : (
            <p className={styles.detail}>
              Revenue amounts are not yet available: the payment ledger
              (migration 002) is not installed on this database. Payment counts
              remain available.
            </p>
          )}
        </section>
      </div>

      <div className={styles.split}>
        <section className={styles.panel} aria-labelledby="health-summary">
          <SectionHeading
            id="health-summary"
            title="System health"
            meta={<a href="/admin?view=operations">Operations →</a>}
          />
          <ul className={styles.healthList}>
            <li>
              <StatusPill tone="good">Database connected</StatusPill>
            </li>
            <li>
              <StatusPill
                tone={d.health.testBillingConfigured ? "good" : "warning"}
              >
                Stripe TEST{" "}
                {d.health.testBillingConfigured ? "configured" : "incomplete"}
              </StatusPill>
            </li>
            <li>
              <StatusPill tone={d.health.lastWebhook ? "neutral" : "warning"}>
                Last webhook:{" "}
                {d.health.lastWebhook
                  ? timestamp(d.health.lastWebhook)
                  : "None recorded"}
              </StatusPill>
            </li>
            <li>
              <StatusPill tone={health.ledger.tone}>
                {health.ledger.label}
              </StatusPill>
            </li>
            <li>
              <StatusPill
                tone={
                  i.comparisons.failed_payments.d7.current > 0
                    ? "warning"
                    : "good"
                }
              >
                {number(i.comparisons.failed_payments.d7.current)} failed
                payment attempt(s) · 7 days
              </StatusPill>
            </li>
          </ul>
        </section>
        <section className={styles.panel} aria-labelledby="latest-heading">
          <SectionHeading
            id="latest-heading"
            title="Latest activity"
            meta={<a href="/admin?view=activity">All activity →</a>}
          />
          <ActivityList items={i.feed.slice(0, 6)} />
        </section>
      </div>
    </>
  );
}
