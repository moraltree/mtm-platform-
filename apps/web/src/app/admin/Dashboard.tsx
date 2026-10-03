import type { FounderRole } from "@/lib/founder/policy";
import type {
  ActivityKind,
  FounderOverview,
  StatusKey,
} from "@/lib/founder/types";
import { signOutFounder } from "./actions";
import styles from "./admin.module.css";

/**
 * The approved Founder Console Phase 1 dashboard (664e11f), adapted to
 * the redevelopment's data. Layout, sections, navigation, card patterns
 * and CSS classes are unchanged from the approved version; what changed
 * is where figures come from (Sanity subscription records instead of the
 * historical PostgreSQL tables) and, therefore, which cards can show a
 * number versus the approved "Not yet available" treatment. Nothing here
 * ever renders a zero in place of a metric the application can't
 * actually calculate.
 */

const number = (value: number) => new Intl.NumberFormat("en-GB").format(value);
const timestamp = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));

const statusLabels: Record<StatusKey, string> = {
  active: "Active",
  canceling: "Canceling at period end",
  trialing: "Stripe trialing",
  platform_trial: "Platform trial",
  platform_trial_expired: "Platform trial (expired)",
  past_due: "Past due",
  unpaid: "Unpaid",
  paused: "Paused",
  incomplete: "Incomplete",
  cancelled: "Canceled",
  trial_closed: "Platform trial closed",
  other: "Other",
};
const activityLabels: Record<ActivityKind, [string, string]> = {
  trial: ["Platform trial started", "Free trial record created"],
  subscription: ["Subscription checkout recorded", "Stripe-backed record"],
  cancellation: ["Subscription canceled", "Stripe-backed record"],
};

const NOT_CONNECTED =
  "Subscription records are not connected in this environment.";

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
/** A real count when the data source can provide one, else "Not yet available". */
function Count({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | undefined;
  detail: string;
}) {
  return value === undefined ? (
    <Unavailable label={label} reason={NOT_CONNECTED} />
  ) : (
    <Metric label={label} value={number(value)} detail={detail} />
  );
}

const sourceCopy: Record<
  FounderOverview["source"],
  { badge: string; title: string; body: string }
> = {
  "subscription-records": {
    badge: "TEST integration",
    title: "Subscription record snapshot · data coverage is partial",
    body: "Figures are read-only counts of the subscription records this application stores, including any test-mode records. Revenue amounts, accounts, geography and webhook delivery history are not recorded yet. No live Stripe data is requested.",
  },
  "not-configured": {
    badge: "Data not connected",
    title: "No subscription data connected",
    body: "This environment has no subscription-record store configured, so no figures are shown. Nothing on this page is estimated or invented.",
  },
  "review-fixture": {
    badge: "Development test figures",
    title: "Development test figures — not business data",
    body: "Every number on this page is a fixed development fixture for private visual review. It is not real subscriber, trial or payment data and is never shown in production.",
  },
};

export function Dashboard({
  overview: d,
  role,
}: {
  overview: FounderOverview;
  role: FounderRole;
}) {
  const c = d.counts ?? undefined;
  const copy = sourceCopy[d.source];
  const statuses = d.statuses?.map((s) => ({
    ...s,
    label: statusLabels[s.key],
  }));
  const total = statuses?.reduce((sum, s) => sum + s.count, 0) ?? 0;
  return (
    <div className={`${styles.shell} ${styles.chromeless}`}>
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
          <form action={signOutFounder}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <div className={styles.content}>
        <header className={styles.topbar}>
          <span>Intelligence / Executive overview</span>
          <span className={styles.badge}>{copy.badge}</span>
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
          <strong>{copy.title}</strong>
          <p>{copy.body}</p>
        </div>
        <section aria-labelledby="subscribers-heading">
          <div className={styles.sectionHeading}>
            <h2 id="subscribers-heading">Subscribers</h2>
            <span>Subscription records</span>
          </div>
          <div className={styles.grid4}>
            <Count
              label="Active paid subscribers"
              value={c?.paid}
              detail="Records with active status, including those set to cancel at period end."
            />
            <Count
              label="Active trial users"
              value={c?.trials}
              detail="Card-free platform trials with an unexpired trial end. Separate from Stripe trialing."
            />
            <Count
              label="Canceled subscribers"
              value={c?.cancelled}
              detail="Stripe-backed subscription records with canceled status."
            />
            <Unavailable
              label="Registered accounts"
              reason="This application has no customer account records yet. Subscription records are not unique people."
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
                reason="No invoice amounts or currencies are stored. Subscription status cannot establish revenue."
              />
            ))}
          </div>
          <div className={styles.planStrip}>
            <div>
              <span>Monthly paid accounts</span>
              {c ? (
                <strong>{number(c.monthly)}</strong>
              ) : (
                <strong className={styles.smallValue}>Not yet available</strong>
              )}
            </div>
            <div>
              <span>Annual paid accounts</span>
              {c ? (
                <strong>{number(c.annual)}</strong>
              ) : (
                <strong className={styles.smallValue}>Not yet available</strong>
              )}
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
            <p className={styles.missing}>Not yet available</p>
            <p className={styles.detail}>
              Paid invoices update a subscription&rsquo;s status but are not
              stored as countable payment events. Not an invoice ledger.
            </p>
          </div>
        </section>
        <section id="conversion" aria-labelledby="conversion-heading">
          <div className={styles.sectionHeading}>
            <h2 id="conversion-heading">Trial conversion</h2>
            <span>All recorded trial starts</span>
          </div>
          <div className={styles.grid4}>
            <Count
              label="Started trials"
              value={c?.trialsStarted}
              detail="Platform trial records with a recorded trial start."
            />
            <Unavailable
              label="Converted trials"
              reason="No durable trial-conversion record exists. Closed trial records are not proof of a paid conversion."
            />
            <Unavailable
              label="Trial-to-paid conversion"
              reason="Needs a reliable converted-trial count first."
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
              <span>
                {statuses ? `${number(total)} records` : "Not connected"}
              </span>
            </div>
            <p className={styles.detail}>
              Current subscription records. Canceling records are separated from
              active/trialing; platform trials are separate from Stripe
              trialing.
            </p>
            {statuses ? (
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
            ) : (
              <p className={styles.missing}>Not yet available</p>
            )}
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
              Subscriber country is not stored with subscription records. No
              location is inferred from email addresses, currencies or
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
          {d.activity === null ? (
            <p className={styles.empty}>Not yet available. {NOT_CONNECTED}</p>
          ) : d.activity.length ? (
            <ol className={styles.activity}>
              {d.activity.map((event, index) => (
                <li key={`${event.at}-${index}`}>
                  <span className={styles.activityDot} aria-hidden="true" />
                  <div>
                    <strong>{activityLabels[event.kind][0]}</strong>
                    <span>{activityLabels[event.kind][1]}</span>
                  </div>
                  <time dateTime={event.at}>{timestamp(event.at)}</time>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.empty}>
              No trial or subscription activity has been recorded yet.
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
              label="Subscription records"
              value={
                d.source === "subscription-records"
                  ? "Connected"
                  : d.source === "review-fixture"
                    ? "Review fixture"
                    : "Not configured"
              }
              detail={
                d.source === "subscription-records"
                  ? "Read-only snapshot completed successfully."
                  : d.source === "review-fixture"
                    ? "Development test figures in place of a records store."
                    : "No subscription-record store is configured here."
              }
            />
            <Metric
              label="Stripe integration"
              value={
                d.health.stripeTestConfigured ? "TEST configured" : "Incomplete"
              }
              detail="Configuration presence only. Provider credentials and endpoint delivery are not actively probed."
            />
            <Unavailable
              label="Duplicate protection"
              reason="Webhook event receipts are not stored, so duplicate handling can't be verified from data."
            />
            {d.source === "not-configured" ? (
              <Unavailable
                label="Last Stripe-updated record"
                reason={NOT_CONNECTED}
              />
            ) : (
              <Metric
                label="Last Stripe-updated record"
                value={
                  d.health.lastStripeUpdate
                    ? timestamp(d.health.lastStripeUpdate)
                    : "None recorded"
                }
                detail="Latest record written by the Stripe webhook. Silence does not prove a fault or healthy delivery."
              />
            )}
            <Unavailable
              label="Failed webhook deliveries"
              reason="Delivery attempts and errors are not persisted. This is not a zero-failure claim."
            />
            <Unavailable
              label="Failed payment events"
              reason="Failed payments change a record's status (see Past due) but are not stored as countable events."
            />
          </div>
        </section>
        <details className={styles.definitions}>
          <summary>Metric definitions &amp; data boundaries</summary>
          <p>
            Counts are read-only aggregates over the subscription records this
            application stores. Records are not unique people: one customer can
            hold more than one record. Paid access means a record with active
            status. Platform trials (card-free, 30 days) and Stripe trialing
            subscriptions are separate measures.
          </p>
          <p>
            All times are UTC. Monthly and annual counts come from each
            record&rsquo;s stored plan. Monetary values, payment-event counts,
            conversion, churn and geography are intentionally unavailable until
            auditable sources exist.
          </p>
          <p>
            This console does not send provider requests, expose personal
            details, or modify customer data. Listening, vouchers, content,
            campaign and partner reporting are future modules.
          </p>
        </details>
        <footer className={styles.footer}>
          Moral Tree Media · Private Founder/Admin Analytics · Phase 1
        </footer>
      </div>
    </div>
  );
}
