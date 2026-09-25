import type { Overview } from "@/lib/admin/overview";
import type { Period } from "@/lib/admin/finance";
import {
  Kpi,
  number,
  SectionHeading,
  StatusPill,
  timestamp,
  Unavailable,
} from "./components";
import { healthTone } from "./health";
import styles from "./admin.module.css";

const periodLabels: Record<Period, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  lifetime: "Recorded lifetime",
};

export function OperationsView({ overview: d }: { overview: Overview }) {
  const f = d.finance;
  const i = d.insights;
  const ledger = healthTone(d).ledger;
  return (
    <>
      <section aria-labelledby="health-heading">
        <SectionHeading
          id="health-heading"
          title="System health"
          meta="Configuration & stored evidence"
        />
        <div className={styles.kpiGrid3}>
          <Kpi
            label="Database"
            value={<StatusPill tone="good">Connected</StatusPill>}
            detail="Read-only, consistent snapshot completed successfully."
            definition="This page loaded from one read-only, repeatable-read transaction with a 5-second statement timeout. Failure shows an unavailable screen instead of numbers."
          />
          <Kpi
            label="Stripe integration"
            value={
              <StatusPill
                tone={d.health.testBillingConfigured ? "good" : "warning"}
              >
                {d.health.testBillingConfigured
                  ? "TEST configured"
                  : "Incomplete"}
              </StatusPill>
            }
            detail="Configuration presence only. Provider credentials and endpoint delivery are not actively probed."
            definition="A TEST secret key, a webhook signing secret and two distinct Price IDs are present with valid syntax. No Stripe API call is made."
          />
          <Kpi
            label="Duplicate protection"
            value={
              <StatusPill tone={d.health.deduplication ? "good" : "critical"}>
                {d.health.deduplication ? "Keys verified" : "Needs review"}
              </StatusPill>
            }
            detail="Database primary keys checked for event receipts and billing events. Duplicate attempt counts are not stored."
            definition="Confirms the primary-key constraints that make webhook receipts and billing events idempotent."
          />
          <Kpi
            label="Last committed webhook"
            value={
              d.health.lastWebhook
                ? timestamp(d.health.lastWebhook)
                : "None recorded"
            }
            detail={`${number(d.health.receipts)} committed receipts. ${number(i.webhook.last24h)} in the last 24 hours, ${number(i.webhook.last7d)} in 7 days. Delivery silence does not prove a fault or healthy delivery.`}
            definition="Webhook receipts committed together with their state changes. Receipts from failed processing roll back, so they are never counted here."
          />
          <Unavailable
            label="Failed webhook deliveries"
            reason="Failed processing rolls back; delivery attempts and errors are not persisted. This is not a zero-failure claim."
          />
          <Kpi
            label="Failed payment events"
            value={number(d.health.failedPayments)}
            detail="Recorded PAYMENT_FAILED events, not failed webhook deliveries or unique customers."
            definition="Each invoice.payment_failed event recorded, including Stripe's automatic retries."
          />
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="ledger-heading">
        <SectionHeading
          id="ledger-heading"
          title="Ledger & reconciliation"
          meta={<StatusPill tone={ledger.tone}>{ledger.label}</StatusPill>}
        />
        {f ? (
          <>
            <dl className={styles.miniStats}>
              <div>
                <dt>Payment ledger since</dt>
                <dd className={styles.ddSmall}>
                  {timestamp(f.coverage.ledgerStart)}
                </dd>
              </div>
              <div>
                <dt>Contract snapshots since</dt>
                <dd className={styles.ddSmall}>
                  {timestamp(f.coverage.contractsStart)}
                </dd>
              </div>
              <div>
                <dt>Subscription history since</dt>
                <dd className={styles.ddSmall}>
                  {timestamp(f.coverage.historyStart)}
                </dd>
              </div>
              <div>
                <dt>Unresolved ledger gaps</dt>
                <dd>{number(i.openGaps ?? 0)}</dd>
              </div>
            </dl>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Window</th>
                    <th scope="col">Coverage</th>
                    <th scope="col">Reasons</th>
                  </tr>
                </thead>
                <tbody>
                  {f.revenue.map((w) => (
                    <tr key={w.period}>
                      <th scope="row">{periodLabels[w.period]}</th>
                      <td>
                        <StatusPill
                          tone={
                            w.coverage.status === "complete"
                              ? "good"
                              : "warning"
                          }
                        >
                          {w.coverage.status === "complete"
                            ? "Complete"
                            : "Partial"}
                        </StatusPill>
                      </td>
                      <td className={styles.wrapCell}>
                        {w.coverage.reasons.length
                          ? w.coverage.reasons.join(" ")
                          : "Every payment receipt has a ledger amount."}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={styles.detail}>
              {number(f.mode.testEntries)} TEST-mode and{" "}
              {number(f.mode.liveEntries)} live-mode ledger entries.
              Reconciliation compares ledger payments with stored
              successful-payment receipts; it does not call Stripe.
            </p>
          </>
        ) : (
          <p className={styles.detail}>
            The Phase 2 payment ledger (migration 002) is not installed on this
            database, so revenue, MRR, reconciliation and churn are unavailable.
          </p>
        )}
      </section>

      <details className={styles.definitions}>
        <summary>Metric definitions &amp; data boundaries</summary>
        <p>
          Counts use a single database snapshot. Paid access requires an active
          subscription, future paid-through date and an unblocked account.
          Platform trials and Stripe trialing subscriptions are separate
          measures. Blocked accounts and canceled history remain visible in
          registration and status totals.
        </p>
        <p>
          All reporting windows start at 00:00 UTC; weeks start Monday. Events
          are grouped by database receipt time and may arrive after their
          provider occurrence. Monthly and annual counts may overlap if an
          account has both plans.{" "}
          {f
            ? "Monetary values come only from the idempotent payment ledger, reported per currency by provider occurrence time, and are marked partial where stored payment receipts lack a ledger amount."
            : "Monetary values are intentionally unavailable until an auditable invoice ledger exists."}
        </p>
        <p>
          This console reads existing account, subscription, billing-event,
          ledger and webhook-receipt tables. It does not send provider requests,
          expose personal details, or modify customer data.
        </p>
      </details>
    </>
  );
}
