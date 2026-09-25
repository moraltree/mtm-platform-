import type { Overview } from "@/lib/admin/overview";
import type { ConsoleData } from "@/lib/admin/console";
import type { AdminRole } from "@/lib/admin/policy";
import type { PeriodId } from "@/lib/admin/intel/periods";
import { logout } from "@/app/subscribe/actions";
import { StatusPill, timestamp } from "./components";
import { viewHref } from "./controls";
import { OverviewView } from "./OverviewView";
import { SubscribersView } from "./SubscribersView";
import { CohortsView } from "./CohortsView";
import { RevenueView } from "./RevenueView";
import { FunnelView } from "./FunnelView";
import { AudienceView, CampaignsView } from "./CampaignsView";
import { ListeningView } from "./ListeningView";
import { OperationsView } from "./OperationsView";
import { ActivityList } from "./ActivityList";
import { CoverageView } from "./RoadmapView";
import { NAV_GROUPS, PERIOD_VIEWS, VIEWS, type ViewId } from "./views";
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
      title: "Subscribers",
      lede: "Who is joining, converting, staying and leaving, with fair period comparisons.",
    },
    cohorts: {
      eyebrow: "Audience",
      title: "Cohorts & retention",
      lede: "What happened to each month’s new registrations and trials.",
    },
    finance: {
      eyebrow: "Money",
      title: "Revenue",
      lede: "Revenue from the payment ledger, per currency, with its coverage stated.",
    },
    funnel: {
      eyebrow: "Growth",
      title: "Commercial funnel",
      lede: "From visit to retained subscriber, with every stage’s source stated.",
    },
    campaigns: {
      eyebrow: "Growth",
      title: "Campaigns & partners",
      lede: "Acquisition and outcomes by server-validated campaign.",
    },
    audience: {
      eyebrow: "Growth",
      title: "Audience geography",
      lede: "Where registrations come from, by self-declared country.",
    },
    listening: {
      eyebrow: "Product",
      title: "Listening & content",
      lede: "How families listen, once approved telemetry is switched on.",
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
    coverage: {
      eyebrow: "Trust",
      title: "Data coverage",
      lede: "Which figures are measured, partial, test data or awaiting a source.",
    },
  };

function NoOverview() {
  return (
    <p className={styles.empty}>This section is unavailable for this view.</p>
  );
}

export function Dashboard({
  overview,
  data,
  role,
  view = "overview",
  period = "30d",
  asOf,
}: {
  overview?: Overview;
  data?: ConsoleData;
  role: AdminRole;
  view?: ViewId;
  period?: PeriodId;
  asOf?: string;
}) {
  const consoleData: ConsoleData = data ?? {
    overview: overview ?? null,
    intelInstalled: false,
  };
  const d = consoleData.overview;
  const snapshot = asOf ?? d?.asOf ?? new Date(0).toISOString();
  const page = intro[view];
  const here = viewHref(view, PERIOD_VIEWS.includes(view) ? { period } : {});
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
          {NAV_GROUPS.map((group) => (
            <div key={group} className={styles.navGroup}>
              <p className={styles.navLabel}>{group}</p>
              {VIEWS.filter((v) => v.group === group).map((v) => (
                <a
                  key={v.id}
                  href={viewHref(
                    v.id,
                    PERIOD_VIEWS.includes(v.id) && period !== "30d"
                      ? { period }
                      : {},
                  )}
                  aria-current={v.id === view ? "page" : undefined}
                >
                  {v.label}
                </a>
              ))}
            </div>
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
            <time dateTime={snapshot}>{timestamp(snapshot)}</time>
            <a className={styles.refresh} href={here}>
              Refresh <span aria-hidden="true">↻</span>
            </a>
          </div>
        </section>
        {(view === "overview" || view === "finance") && d && (
          <div className={styles.notice} role="note">
            <strong>Database snapshot · data coverage is partial</strong>
            <p>
              {d.finance
                ? "Figures reflect the connected subscription database, including any retained test fixtures. Revenue comes only from the payment ledger and is labelled with its coverage. Geography and webhook failure history are not recorded yet. No live Stripe data is requested."
                : "Figures reflect the connected subscription database, including any retained test fixtures. Revenue amounts, geography and webhook failure history are not recorded yet. No live Stripe data is requested."}
            </p>
          </div>
        )}
        {view === "overview" &&
          (d ? (
            <OverviewView overview={d} coverage={consoleData.coverage} />
          ) : (
            <NoOverview />
          ))}
        {view === "growth" &&
          (d ? (
            <SubscribersView overview={d} intel={consoleData.subscribers} />
          ) : (
            <NoOverview />
          ))}
        {view === "cohorts" && <CohortsView intel={consoleData.cohorts} />}
        {view === "finance" &&
          (d ? (
            <RevenueView overview={d} intel={consoleData.revenue} />
          ) : (
            <NoOverview />
          ))}
        {view === "funnel" && (
          <FunnelView
            campaigns={consoleData.campaigns}
            listening={consoleData.listening}
          />
        )}
        {view === "campaigns" && (
          <CampaignsView
            intel={consoleData.campaigns}
            listening={consoleData.listening}
          />
        )}
        {view === "audience" && <AudienceView intel={consoleData.audience} />}
        {view === "listening" && (
          <ListeningView intel={consoleData.listening} />
        )}
        {view === "operations" &&
          (d ? <OperationsView overview={d} /> : <NoOverview />)}
        {view === "activity" &&
          (d ? (
            <section
              className={styles.panel}
              aria-labelledby="activity-heading"
            >
              <h2 id="activity-heading" className={styles.srOnly}>
                Latest records
              </h2>
              <ActivityList items={d.insights.feed} />
              <p className={styles.detail}>
                Latest 25 records · UTC. Registrations, trials, payments,
                conversions, cancellations, refunds and disputes.
              </p>
            </section>
          ) : (
            <NoOverview />
          ))}
        {view === "coverage" && <CoverageView intel={consoleData.coverage} />}
        <footer className={styles.footer}>
          Moral Tree Media · Private Founder/Admin Analytics · Phase 4 ·
          Read-only
        </footer>
      </div>
    </div>
  );
}
