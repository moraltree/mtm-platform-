import type { Overview } from "@/lib/admin/overview";
import type { Finance } from "@/lib/admin/financeSnapshot";
import type { Period } from "@/lib/admin/finance";
import { share, UP_IS_GOOD, type SeriesKey } from "@/lib/admin/insights";
import { BarTrend, ShareBars } from "./charts";
import {
  Delta,
  InfoTip,
  Kpi,
  number,
  percent,
  SectionHeading,
  timestamp,
  Unavailable,
} from "./components";
import styles from "./admin.module.css";

const statusLabels: Record<string, string> = {
  active: "Active",
  trialing: "Stripe trialing",
  canceling: "Canceling at period end",
  canceled: "Canceled",
  past_due: "Past due",
  unpaid: "Unpaid",
  paused: "Paused",
  incomplete: "Incomplete",
  incomplete_expired: "Incomplete expired",
  other: "Other",
};
const seriesLabels: Record<SeriesKey, string> = {
  registrations: "Registrations",
  trial_starts: "Trial starts",
  conversions: "Trial conversions",
  new_paid: "New paid subscriptions",
  cancellations: "Cancellations",
  payments: "Successful payments",
  failed_payments: "Failed payment attempts",
};
const periodLabels: Record<Period, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  lifetime: "Recorded lifetime",
};
const monthName = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));

function Lifecycle({ finance: f }: { finance: Finance }) {
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
  return (
    <section className={styles.panel} aria-labelledby="lifecycle-heading">
      <SectionHeading
        id="lifecycle-heading"
        title="Subscriber movement"
        meta="Recorded receipt time · UTC"
      />
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
        Paid and cancellation counts come from durable billing events. Returning
        = a paid subscription for an account that had an earlier one. †
        Scheduled cancellations are recorded only since subscription history
        began ({timestamp(f.coverage.historyStart)} UTC); earlier windows are
        incomplete.
      </p>
    </section>
  );
}

export function GrowthView({ overview: d }: { overview: Overview }) {
  const c = d.counts;
  const f = d.finance;
  const i = d.insights;
  const statuses = Object.entries(statusLabels).map(([key, label]) => ({
    key,
    label,
    count: d.statuses.find((s) => s.status === key)?.count ?? 0,
  }));
  const statusTotal = statuses.reduce((sum, s) => sum + s.count, 0);
  const churn = f?.churn;
  return (
    <>
      <div className={styles.split}>
        <section className={styles.panel} aria-labelledby="funnel-heading">
          <SectionHeading
            id="funnel-heading"
            title="Registration → trial → paid"
            meta={
              <InfoTip label="the conversion funnel">
                All-time counts with shares of registered accounts. Stages are
                not strictly nested: a direct purchase can skip the trial, so
                “Ever paid” can exceed “Converted from trial”. Recent
                registrations have not had time to convert.
              </InfoTip>
            }
          />
          <ShareBars
            caption="Conversion funnel, all time"
            rows={[
              {
                label: "Registered accounts",
                value: c.accounts,
                share: share(c.accounts, c.accounts),
              },
              {
                label: "Started a trial",
                value: c.trials_started,
                share: share(c.trials_started, c.accounts),
              },
              {
                label: "Converted from trial",
                value: c.converted,
                share: share(c.converted, c.accounts),
                note: `Trial-to-paid: ${percent(d.conversionRate)} of started trials.`,
              },
              {
                label: "Ever paid (any route)",
                value: i.everPaid,
                share: share(i.everPaid, c.accounts),
              },
              {
                label: "Paying now",
                value: c.paid,
                share: share(c.paid, c.accounts),
              },
            ]}
          />
        </section>
        <section className={styles.panel} aria-labelledby="compare-heading">
          <SectionHeading
            id="compare-heading"
            title="Period comparison"
            meta="Rolling windows ending now"
          />
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Measure</th>
                  <th scope="col">Last 7 days · vs prior 7</th>
                  <th scope="col">Last 30 days · vs prior 30</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(seriesLabels) as SeriesKey[]).map((key) => (
                  <tr key={key}>
                    <th scope="row">{seriesLabels[key]}</th>
                    {(["d7", "d30"] as const).map((w) => (
                      <td key={w}>
                        <strong>{number(i.comparisons[key][w].current)}</strong>
                        <Delta
                          comparison={i.comparisons[key][w]}
                          period={w === "d7" ? "7 days" : "30 days"}
                          upIsGood={UP_IS_GOOD[key]}
                          compact
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.detail}>
            Each window is compared with the equal window immediately before it.
            Billing events use database receipt time.
          </p>
        </section>
      </div>

      <section aria-labelledby="trend-heading">
        <SectionHeading
          id="trend-heading"
          title="Daily trends"
          meta={
            i.dataStart
              ? `Last 30 days · records since ${timestamp(i.dataStart)} UTC`
              : "Last 30 days"
          }
        />
        <div className={styles.chartGrid}>
          {(
            [
              "registrations",
              "trial_starts",
              "new_paid",
              "cancellations",
            ] as const
          ).map((key) => (
            <BarTrend
              key={key}
              title={seriesLabels[key]}
              unit={seriesLabels[key].toLowerCase()}
              points={i.series[key]}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="conversion-heading">
        <SectionHeading
          id="conversion-heading"
          title="Trial conversion & retention"
        />
        <div className={styles.kpiGrid}>
          <Kpi
            label="Started trials"
            value={number(c.trials_started)}
            detail="Accounts with a recorded trial start and a positive trial length."
            definition="Accounts with a recorded platform trial start and a positive trial length."
          />
          <Kpi
            label="Trial-to-paid conversion"
            value={percent(d.conversionRate)}
            detail={
              d.conversionRate === null
                ? "Not yet available: no recorded trial starts."
                : "Converted trials ÷ started trials. Includes ongoing trials; not a matured cohort rate."
            }
            definition="Started trials marked converted or with a durable trial-conversion event, divided by started trials."
          />
          {f ? (
            <Kpi
              label="Matured trial conversion"
              value={percent(f.maturedTrials.rate)}
              detail={
                f.maturedTrials.rate === null
                  ? "Not yet available: no trial deadline has passed."
                  : `${number(f.maturedTrials.converted)} of ${number(f.maturedTrials.matured)} trials whose deadline has passed converted (at any time).`
              }
              definition="Of trials whose single platform deadline has passed, the share that converted at any time."
            />
          ) : (
            <Unavailable
              label="Churn rate"
              reason="No opening subscriber cohort or historical status snapshots. Cancellation counts alone are insufficient."
            />
          )}
          {churn && (
            <Kpi
              label="Paid subscriber churn"
              value={churn.status === "available" ? percent(churn.rate) : "—"}
              detail={
                churn.status === "available" ? (
                  <>
                    {monthName(churn.monthStart)}: {number(churn.churned)} of{" "}
                    {number(churn.opening)} accounts with paid access at the
                    month’s opening had none at its close.
                    {churn.rate === null && " No opening paid subscribers."}
                  </>
                ) : (
                  <>
                    Not yet available. Subscription history began{" "}
                    {timestamp(f!.coverage.historyStart)} UTC. The first
                    complete month with a known opening cohort is{" "}
                    {monthName(churn.firstMeasurableMonth)}, measurable from{" "}
                    {timestamp(churn.availableFrom)} UTC. Not reconstructed from
                    current state.
                  </>
                )
              }
              definition="Account-level: accounts with paid access at a month's opening instant that have none at its close, divided by the opening count. Only complete UTC months inside history coverage."
            />
          )}
        </div>
      </section>

      <div className={styles.split}>
        {f ? <Lifecycle finance={f} /> : <div />}
        <section className={styles.panel} aria-labelledby="status-heading">
          <SectionHeading
            id="status-heading"
            title="Subscription status"
            meta={`${number(statusTotal)} records`}
          />
          <p className={styles.detail}>
            Current Stripe projections. Canceling records are separated from
            active/trialing. An account can have multiple subscriptions.
          </p>
          <ShareBars
            caption="Subscription records by current status"
            rows={statuses.map((s) => ({
              label: s.label,
              value: s.count,
              share: share(s.count, statusTotal),
            }))}
          />
        </section>
      </div>
    </>
  );
}
