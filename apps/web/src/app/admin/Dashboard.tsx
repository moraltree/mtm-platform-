import type { Overview } from "@/lib/admin/overview";
import type { AdminRole } from "@/lib/admin/policy";
import { logout } from "@/app/subscribe/actions";
import { StatusPill, timestamp } from "./components";
import { OverviewView } from "./OverviewView";
import { GrowthView } from "./GrowthView";
import { FinanceView } from "./FinanceView";
import { OperationsView } from "./OperationsView";
import { ActivityList } from "./ActivityList";
import { RoadmapView } from "./RoadmapView";
import { VIEWS, type ViewId } from "./views";
import styles from "./admin.module.css";

const intro: Record<ViewId, { eyebrow: string; title: string; lede: string }> =
  {
    overview: {
      eyebrow: "The big picture",
      title: "Executive overview",
      lede: "Your audiobook platform, at a glance.",
    },
    growth: {
      eyebrow: "Audience",
      title: "Subscribers & conversion",
      lede: "How people move from registration to paid, and what changes week to week.",
    },
    finance: {
      eyebrow: "Money",
      title: "Finance",
      lede: "Revenue from the payment ledger, per currency, with its coverage stated.",
    },
    operations: {
      eyebrow: "Reliability",
      title: "Operations",
      lede: "Database, Stripe configuration, webhooks and ledger reconciliation.",
    },
    activity: {
      eyebrow: "Timeline",
      title: "Recent activity",
      lede: "The latest account and billing events. No personal details are shown.",
    },
    roadmap: {
      eyebrow: "Coming next",
      title: "Future analytics",
      lede: "Areas that switch on once a trustworthy data source exists.",
    },
  };

export function Dashboard({
  overview: d,
  role,
  view = "overview",
}: {
  overview: Overview;
  role: AdminRole;
  view?: ViewId;
}) {
  const f = d.finance;
  const page = intro[view];
  const href = (id: ViewId) =>
    id === "overview" ? "/admin" : `/admin?view=${id}`;
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Console navigation">
        <a className={styles.brand} href="/admin">
          <span className={styles.monogram} aria-hidden="true">
            M
          </span>
          <span>
            Moral Tree Media<small>FOUNDER CONSOLE</small>
          </span>
        </a>
        <nav aria-label="Console sections">
          {VIEWS.map((v) => (
            <a
              key={v.id}
              href={href(v.id)}
              aria-current={v.id === view ? "page" : undefined}
            >
              {v.label}
            </a>
          ))}
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
      <div className={styles.content} id="console">
        <header className={styles.topbar}>
          <span>
            Founder Console / <strong>{page.title}</strong>
          </span>
          <span className={styles.topbarRight}>
            <StatusPill tone="neutral">TEST integration</StatusPill>
          </span>
        </header>
        <section className={styles.hero} aria-labelledby="page-title">
          <div>
            <p className={styles.eyebrow}>{page.eyebrow}</p>
            <h1 id="page-title">{page.title}</h1>
            <p>{page.lede}</p>
          </div>
          <div className={styles.snapshot}>
            <p>Snapshot · UTC</p>
            <time dateTime={d.asOf}>{timestamp(d.asOf)}</time>
            <a className={styles.refresh} href={href(view)}>
              Refresh <span aria-hidden="true">↻</span>
            </a>
          </div>
        </section>
        {(view === "overview" || view === "finance") && (
          <div className={styles.notice} role="note">
            <strong>Database snapshot · data coverage is partial</strong>
            <p>
              {f
                ? "Figures reflect the connected subscription database, including any retained test fixtures. Revenue comes only from the payment ledger and is labelled with its coverage. Geography and webhook failure history are not recorded yet. No live Stripe data is requested."
                : "Figures reflect the connected subscription database, including any retained test fixtures. Revenue amounts, geography and webhook failure history are not recorded yet. No live Stripe data is requested."}
            </p>
          </div>
        )}
        {view === "overview" && <OverviewView overview={d} />}
        {view === "growth" && <GrowthView overview={d} />}
        {view === "finance" && <FinanceView overview={d} />}
        {view === "operations" && <OperationsView overview={d} />}
        {view === "activity" && (
          <section className={styles.panel} aria-labelledby="activity-heading">
            <h2 id="activity-heading" className={styles.srOnly}>
              Latest records
            </h2>
            <ActivityList items={d.insights.feed} />
            <p className={styles.detail}>
              Latest 25 records · UTC. Registrations, trials, payments,
              conversions, cancellations, refunds and disputes.
            </p>
          </section>
        )}
        {view === "roadmap" && <RoadmapView />}
        <footer className={styles.footer}>
          Moral Tree Media · Private Founder/Admin Analytics · Phase 3 ·
          Read-only
        </footer>
      </div>
    </div>
  );
}
