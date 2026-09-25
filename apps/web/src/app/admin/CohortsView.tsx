import type { CohortIntel } from "@/lib/admin/intel/load";
import { share } from "@/lib/admin/insights";
import {
  InfoTip,
  number,
  percent,
  SectionHeading,
  StatusPill,
  timestamp,
} from "./components";
import { ExportLink, NotInstalled } from "./controls";
import styles from "./admin.module.css";

const monthLabel = (month: string) =>
  new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));

/** A count with its share of the cohort base, e.g. "12 · 40%". */
function Cell({ value, of }: { value: number; of: number }) {
  return (
    <td>
      {number(value)}
      <span className={styles.cellShare}> · {percent(share(value, of))}</span>
    </td>
  );
}

export function CohortsView({ intel }: { intel?: CohortIntel }) {
  if (!intel) return <NotInstalled what="Cohort reporting" />;
  return (
    <>
      <div className={styles.toolbar}>
        <p className={styles.lede}>
          Cohorts group accounts by the UTC month they registered or began a
          trial, then show what has happened to each group so far.
        </p>
        <ExportLink report="cohorts" />
      </div>
      <section className={styles.panel} aria-labelledby="reg-cohorts">
        <SectionHeading
          id="reg-cohorts"
          title="Registration cohorts"
          meta={
            <InfoTip label="registration cohorts">
              Outcomes to date for accounts registered in each month. Trial,
              conversion, paid, cancellation and reactivation come from durable
              events. “Paying now” is today’s state, so paid retention is “still
              paying today”, not a month-by-month curve.
            </InfoTip>
          }
        />
        {intel.registration.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Cohort</th>
                  <th scope="col">Registered</th>
                  <th scope="col">Started trial</th>
                  <th scope="col">Converted from trial</th>
                  <th scope="col">Ever paid</th>
                  <th scope="col">Paying now</th>
                  <th scope="col">Paid retention today</th>
                  <th scope="col">Cancelled</th>
                  <th scope="col">Reactivated</th>
                </tr>
              </thead>
              <tbody>
                {intel.registration.map((r) => (
                  <tr key={r.month}>
                    <th scope="row">{monthLabel(r.month)}</th>
                    <td>{number(r.registered)}</td>
                    <Cell value={r.trials} of={r.registered} />
                    <Cell value={r.converted} of={r.trials} />
                    <Cell value={r.everPaid} of={r.registered} />
                    <td>{number(r.payingNow)}</td>
                    <td>{percent(share(r.payingNow, r.everPaid))}</td>
                    <Cell value={r.cancelled} of={r.everPaid} />
                    <td>{number(r.reactivated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.empty}>No accounts registered yet.</p>
        )}
        <p className={styles.detail}>
          Shares: started trial and ever paid are of registrations; converted is
          of trials started; cancelled is of ever-paid accounts. Latest 24
          months.
        </p>
      </section>

      <section className={styles.panel} aria-labelledby="trial-cohorts">
        <SectionHeading
          id="trial-cohorts"
          title="Trial cohorts"
          meta="By trial-start month"
        />
        {intel.trial.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Trial month</th>
                  <th scope="col">Trials started</th>
                  <th scope="col">Deadline passed</th>
                  <th scope="col">Converted (all)</th>
                  <th scope="col">Matured conversion</th>
                </tr>
              </thead>
              <tbody>
                {intel.trial.map((r) => (
                  <tr key={r.month}>
                    <th scope="row">{monthLabel(r.month)}</th>
                    <td>{number(r.started)}</td>
                    <Cell value={r.matured} of={r.started} />
                    <Cell value={r.converted} of={r.started} />
                    <td>
                      {r.matured
                        ? `${percent(share(r.maturedConverted, r.matured))} (${number(r.maturedConverted)} of ${number(r.matured)})`
                        : "Not yet: no deadline passed"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.empty}>No trials started yet.</p>
        )}
        <p className={styles.detail}>
          Matured conversion only counts trials whose single platform deadline
          has passed, so recent cohorts are not understated.
        </p>
      </section>

      <div className={styles.split}>
        <section className={styles.panel} aria-labelledby="curve-heading">
          <SectionHeading id="curve-heading" title="Monthly retention curve" />
          <StatusPill tone="warning">Not yet measurable</StatusPill>
          <p className={styles.detail}>
            A month-by-month paid-retention curve needs each subscriber’s paid
            state at every month end.{" "}
            {intel.historyStart
              ? `Subscription history has recorded that since ${timestamp(intel.historyStart)} UTC; curves become available for subscribers first paid after that date once a full month has elapsed.`
              : "Subscription history is not installed."}{" "}
            Earlier months are never reconstructed from current state.
          </p>
        </section>
        <section className={styles.panel} aria-labelledby="activation-heading">
          <SectionHeading id="activation-heading" title="Trial activation" />
          <StatusPill tone="neutral">Awaiting telemetry</StatusPill>
          <p className={styles.detail}>
            Activation means a trial user actually listened. It needs the
            listening telemetry designed in Phase 4 (not yet enabled). The
            stored TRIAL_ACTIVE marker is written at the same instant as the
            trial start, so it is not reported as activation.
          </p>
        </section>
      </div>
    </>
  );
}
