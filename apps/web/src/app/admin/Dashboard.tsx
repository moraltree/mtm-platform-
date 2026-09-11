import type { Overview } from "@/lib/admin/overview";
import type { AdminRole } from "@/lib/admin/policy";
import { logout } from "@/app/subscribe/actions";
import styles from "./admin.module.css";
const number = (value: number) => new Intl.NumberFormat("en-GB").format(value);
const timestamp = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
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
const activityLabels = {
  registration: "Account registered",
  payment: "Successful subscription payment",
  conversion: "Trial converted to paid",
  cancellation: "Subscription canceled",
};
function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className={styles.metric}>
      <h3>{label}</h3>
      <p className={styles.value}>{value}</p>
      <p className={styles.detail}>{detail}</p>
    </article>
  );
}
function Unavailable({ label, reason }: { label: string; reason: string }) {
  return (
    <article className={styles.metric}>
      <h3>{label}</h3>
      <p className={styles.missing}>Not yet available</p>
      <p className={styles.detail}>{reason}</p>
    </article>
  );
}
export function Dashboard({
  overview: d,
  role,
}: {
  overview: Overview;
  role: AdminRole;
}) {
  const c = d.counts;
  const statuses = Object.entries(statusLabels).map(([key, label]) => ({
    key,
    label,
    count: d.statuses.find((s) => s.status === key)?.count ?? 0,
  }));
  const total = statuses.reduce((sum, s) => sum + s.count, 0);
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Console navigation">
        <a className={styles.brand} href="/admin">
          <span className={styles.monogram} aria-hidden="true">
            M
          </span>
          <span>
            Moral Tree Media<small>AUDIOBOOK PLATFORM</small>
          </span>
        </a>
        <p className={styles.navLabel}>FOUNDER CONSOLE</p>
        <nav aria-label="Analytics sections">
          <a href="#overview" aria-current="page">
            Executive overview
          </a>
          <a href="#revenue">Revenue &amp; plans</a>
          <a href="#conversion">Conversion</a>
          <a href="#subscriptions">Subscription status</a>
          <a href="#geography">Geography</a>
          <a href="#activity">Recent activity</a>
          <a href="#health">System health</a>
        </nav>
        <div className={styles.sidebarBottom}>
          <span className={styles.badge}>
            {role === "founder" ? "Founder" : "Admin"} access
          </span>
          <p>
            Private workspace
            <br />
            Read-only reporting
          </p>
          <form action={logout}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <div className={styles.content}>
        <header className={styles.topbar}>
          <span>Intelligence / Executive overview</span>
          <span className={styles.badge}>TEST integration</span>
        </header>
        <section id="overview" className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>THE BIG PICTURE</p>
            <h1>Executive overview</h1>
            <p>Your audiobook platform, at a glance.</p>
          </div>
          <div className={styles.snapshot}>
            <p>Snapshot · UTC</p>
            <time dateTime={d.asOf}>{timestamp(d.asOf)}</time>
            <a className={styles.refresh} href="/admin">
              Refresh overview ↻
            </a>
          </div>
        </section>
        <div className={styles.notice} role="note">
          <strong>Database snapshot · data coverage is partial</strong>
          <p>
            Figures reflect the connected subscription database, including any
            retained test fixtures. Revenue amounts, geography and webhook
            failure history are not recorded yet. No live Stripe data is
            requested.
          </p>
        </div>
        <section aria-labelledby="subscribers-heading">
          <div className={styles.sectionHeading}>
            <h2 id="subscribers-heading">Subscribers</h2>
            <span>Unique accounts</span>
          </div>
          <div className={styles.grid4}>
            <Metric
              label="Active paid subscribers"
              value={number(c.paid)}
              detail="Unblocked accounts with active status and a future paid-through date."
            />
            <Metric
              label="Active trial users"
              value={number(c.trials)}
              detail="Unblocked, unexpired platform trials without current paid access."
            />
            <Metric
              label="Canceled subscribers"
              value={number(c.canceled_accounts)}
              detail="Accounts with any canceled subscription, including those who later rejoined."
            />
            <Metric
              label="Registered accounts"
              value={number(c.accounts)}
              detail="All stored accounts, including blocked accounts and administrators."
            />
          </div>
        </section>
        <section id="revenue" aria-labelledby="revenue-heading">
          <div className={styles.sectionHeading}>
            <h2 id="revenue-heading">Revenue &amp; plans</h2>
            <span>UTC · week starts Monday</span>
          </div>
          <div className={styles.grid4}>
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
          <div className={styles.panel}>
            <h3>Recorded successful payment events</h3>
            <p className={styles.detail}>
              Event receipt time, not settlement time. Deduplicated by Stripe
              event ID; not an invoice ledger.
            </p>
            <dl className={styles.paymentCounts}>
              {Object.entries(d.payments).map(([key, value]) => (
                <div key={key}>
                  <dt>
                    {
                      {
                        today: "Today",
                        week: "This week",
                        month: "This month",
                        lifetime: "All time",
                      }[key]
                    }
                  </dt>
                  <dd>{number(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
        <section id="conversion" aria-labelledby="conversion-heading">
          <div className={styles.sectionHeading}>
            <h2 id="conversion-heading">Trial conversion</h2>
            <span>All recorded trial starts</span>
          </div>
          <div className={styles.grid4}>
            <Metric
              label="Started trials"
              value={number(c.trials_started)}
              detail="Accounts with a recorded trial start and a positive trial length."
            />
            <Metric
              label="Converted trials"
              value={number(c.converted)}
              detail="Started trials marked converted or with a durable trial-conversion event."
            />
            <Metric
              label="Trial-to-paid conversion"
              value={d.conversionRate === null ? "—" : `${d.conversionRate}%`}
              detail={
                d.conversionRate === null
                  ? "Not yet available: no recorded trial starts."
                  : "Converted trials ÷ started trials. Includes ongoing trials; not a matured cohort rate."
              }
            />
            <Unavailable
              label="Churn rate"
              reason="No opening subscriber cohort or historical status snapshots. Cancellation counts alone are insufficient."
            />
          </div>
        </section>
        <div className={styles.twoColumns}>
          <section
            id="subscriptions"
            className={styles.panel}
            aria-labelledby="status-heading"
          >
            <div className={styles.sectionHeading}>
              <h2 id="status-heading">Subscription status</h2>
              <span>{number(total)} records</span>
            </div>
            <p className={styles.detail}>
              Current Stripe projections. Canceling records are separated from
              active/trialing. An account can have multiple subscriptions.
            </p>
            <ul className={styles.statusList}>
              {statuses.map((s) => (
                <li key={s.key}>
                  <div>
                    <span>{s.label}</span>
                    <strong>{number(s.count)}</strong>
                  </div>
                  <div className={styles.track} aria-hidden="true">
                    <span
                      style={{
                        width: `${total ? (s.count / total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section
            id="geography"
            className={`${styles.panel} ${styles.geography}`}
            aria-labelledby="geography-heading"
          >
            <p className={styles.eyebrow}>AUDIENCE REACH</p>
            <h2 id="geography-heading">A world of listeners</h2>
            <div className={styles.emptyMark} aria-hidden="true">
              ◎
            </div>
            <h3>Country breakdown</h3>
            <p className={styles.missing}>Not yet available</p>
            <p>
              Subscriber country is not stored in the current analytics schema.
              No location is inferred from email addresses, currencies or
              campaigns.
            </p>
            <div className={styles.futureNote}>
              Ready for a future country dimension, with a documented source and
              coverage.
            </div>
          </section>
        </div>
        <section
          id="activity"
          className={styles.panel}
          aria-labelledby="activity-heading"
        >
          <div className={styles.sectionHeading}>
            <h2 id="activity-heading">Recent activity</h2>
            <span>Latest 20 records · UTC</span>
          </div>
          {d.activity.length ? (
            <ol className={styles.activity}>
              {d.activity.map((event, index) => (
                <li key={`${event.at}-${index}`}>
                  <span className={styles.activityDot} aria-hidden="true" />
                  <div>
                    <strong>{activityLabels[event.kind]}</strong>
                    <span>
                      {event.kind === "registration"
                        ? "Account created"
                        : "Recorded billing event"}
                    </span>
                  </div>
                  <time dateTime={event.at}>{timestamp(event.at)}</time>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.empty}>
              No account or billing activity has been recorded yet.
            </p>
          )}
        </section>
        <section id="health" aria-labelledby="health-heading">
          <div className={styles.sectionHeading}>
            <h2 id="health-heading">System health</h2>
            <span>Configuration &amp; stored evidence</span>
          </div>
          <div className={styles.grid3}>
            <Metric
              label="Database"
              value="Connected"
              detail="Read-only, consistent snapshot completed successfully."
            />
            <Metric
              label="Stripe integration"
              value={
                d.health.testBillingConfigured
                  ? "TEST configured"
                  : "Incomplete"
              }
              detail="Configuration presence only. Provider credentials and endpoint delivery are not actively probed."
            />
            <Metric
              label="Duplicate protection"
              value={d.health.deduplication ? "Keys verified" : "Needs review"}
              detail="Database primary keys checked for event receipts and billing events. Duplicate attempt counts are not stored."
            />
            <Metric
              label="Last committed webhook"
              value={
                d.health.lastWebhook
                  ? timestamp(d.health.lastWebhook)
                  : "None recorded"
              }
              detail={`${number(d.health.receipts)} committed receipts. Delivery silence does not prove a fault or healthy delivery.`}
            />
            <Unavailable
              label="Failed webhook deliveries"
              reason="Failed processing rolls back; delivery attempts and errors are not persisted. This is not a zero-failure claim."
            />
            <Metric
              label="Failed payment events"
              value={number(d.health.failedPayments)}
              detail="Recorded PAYMENT_FAILED events, not failed webhook deliveries or unique customers."
            />
          </div>
        </section>
        <details className={styles.definitions}>
          <summary>Metric definitions &amp; data boundaries</summary>
          <p>
            Counts use a single database snapshot. Paid access requires an
            active subscription, future paid-through date and an unblocked
            account. Platform trials and Stripe trialing subscriptions are
            separate measures. Blocked accounts and canceled history remain
            visible in registration and status totals.
          </p>
          <p>
            All reporting windows start at 00:00 UTC; weeks start Monday. Events
            are grouped by database receipt time and may arrive after their
            provider occurrence. Monthly and annual counts may overlap if an
            account has both plans. Monetary values are intentionally
            unavailable until an auditable invoice ledger exists.
          </p>
          <p>
            This console reads existing account, subscription, billing-event and
            webhook-receipt tables. It does not send provider requests, expose
            personal details, or modify customer data. Listening, vouchers,
            content, campaign and partner reporting are future modules.
          </p>
        </details>
        <footer className={styles.footer}>
          Moral Tree Media · Private Founder/Admin Analytics · Phase 1
        </footer>
      </div>
    </div>
  );
}
