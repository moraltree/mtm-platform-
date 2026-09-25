import type { Overview } from "@/lib/admin/overview";
import type { SubscriberIntel } from "@/lib/admin/intel/load";
import { compare } from "@/lib/admin/insights";
import { BarTrend } from "./charts";
import {
  Delta,
  InfoTip,
  Kpi,
  number,
  SectionHeading,
  StatusPill,
  timestamp,
} from "./components";
import {
  ExportLink,
  NotInstalled,
  PeriodKpi,
  PeriodNote,
  PeriodTabs,
  viewHref,
} from "./controls";
import { GrowthView } from "./GrowthView";
import styles from "./admin.module.css";

const METRICS = [
  {
    key: "registrations",
    label: "New registrations",
    up: true,
    def: "Verified accounts created in the period (mtm_accounts.created_at).",
    drill: "cohorts",
  },
  {
    key: "trial_starts",
    label: "Trial starts",
    up: true,
    def: "Platform trials that began in the period (positive trial length). Trial activation (a first listen) needs listening telemetry.",
    drill: "cohorts",
  },
  {
    key: "conversions",
    label: "Trial-to-paid conversions",
    up: true,
    def: "Durable TRIAL_CONVERTED events recorded in the period. Direct purchases without a trial are not conversions.",
    drill: "cohorts",
  },
  {
    key: "new_paid",
    label: "New paid subscriptions",
    up: true,
    def: "First positive paid invoice per subscription (PAID_SUBSCRIPTION_CONFIRMED), recorded in the period.",
    drill: "finance",
  },
  {
    key: "new_paid_accounts",
    label: "First-time paying subscribers",
    up: true,
    def: "Accounts whose first-ever paid subscription was confirmed in the period.",
    drill: "cohorts",
  },
  {
    key: "reactivations",
    label: "Reactivated subscribers",
    up: true,
    def: "A paid subscription confirmed for an account after that account had a recorded cancellation.",
    drill: "activity",
  },
  {
    key: "cancellations",
    label: "Completed cancellations",
    up: false,
    def: "Subscriptions ended (customer.subscription.deleted) in the period. Scheduled cancellations are counted separately.",
    drill: "activity",
  },
  {
    key: "failed_payments",
    label: "Failed payment attempts",
    up: false,
    def: "Each invoice.payment_failed event, including Stripe's automatic retries. See Revenue for failed value.",
    drill: "finance",
  },
] as const;

export function SubscribersView({
  overview: d,
  intel,
}: {
  overview: Overview;
  intel?: SubscriberIntel;
}) {
  const c = d.counts;
  if (!intel)
    return (
      <>
        <NotInstalled what="Period subscriber intelligence" />
        <GrowthView overview={d} />
      </>
    );
  const p = intel.period;
  const net = intel.netSubscriptions;
  return (
    <>
      <div className={styles.toolbar}>
        <PeriodTabs view="growth" period={p.id} />
        <ExportLink report="subscribers" period={p.id} />
      </div>
      <PeriodNote
        label={p.label}
        start={p.start}
        compareLabel={p.compareLabel}
      />

      <section aria-labelledby="now-heading">
        <SectionHeading
          id="now-heading"
          title="Subscribers right now"
          meta="Current state · unique accounts"
        />
        <div className={styles.kpiGrid}>
          <Kpi
            hero
            label="Active paid subscribers"
            value={number(c.paid)}
            detail="Unblocked accounts with active status and a future paid-through date."
            definition="Distinct unblocked accounts with at least one active subscription whose paid-through date is in the future."
          />
          <Kpi
            label="Monthly / annual"
            value={`${number(c.monthly)} / ${number(c.annual)}`}
            detail="Paid accounts by plan; an account holding both appears in each."
            definition="Distinct paid accounts per stored plan (Phase 1 definition)."
          >
            <a
              className={styles.drill}
              href={viewHref("finance", { period: p.id })}
            >
              Plan revenue <span aria-hidden="true">→</span>
            </a>
          </Kpi>
          <Kpi
            label="Scheduled cancellations"
            value={number(intel.scheduled.accountsNow)}
            detail={
              intel.scheduled.inPeriod === null
                ? "Accounts set to cancel at period end. Newly scheduled in this period: not measurable before subscription history began."
                : `Accounts set to cancel at period end. ${number(intel.scheduled.inPeriod)} newly scheduled in this period.`
            }
            definition="Accounts with an active or trialing subscription marked cancel-at-period-end. They keep access until the paid-through date."
          />
          <Kpi
            label="Net subscription movement"
            value={`${net.current > 0 ? "+" : ""}${number(net.current)}`}
            detail="New paid subscriptions − completed cancellations in the period."
            definition="Event-based: counts subscription starts and deletions. Lapses from failed renewals without a cancellation are not included; the history-based change below captures them where measurable."
          >
            {net.previous !== null && (
              <Delta
                comparison={compare(net.current, net.previous)}
                period=""
                against={p.compareLabel}
                upIsGood
              />
            )}
          </Kpi>
        </div>
      </section>

      <section aria-labelledby="period-heading">
        <SectionHeading
          id="period-heading"
          title={`Movement · ${p.label}`}
          meta={p.compareLabel ? `vs ${p.compareLabel}` : "All history"}
        />
        <div className={styles.kpiGrid}>
          {METRICS.map((m) => (
            <PeriodKpi
              key={m.key}
              label={m.label}
              value={intel.metrics[m.key].current}
              comparison={intel.metrics[m.key].comparison}
              compareLabel={p.compareLabel}
              upIsGood={m.up}
              definition={m.def}
              href={viewHref(m.drill, { period: p.id })}
            />
          ))}
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="growth-heading">
        <SectionHeading
          id="growth-heading"
          title="Subscriber growth (paid accounts)"
          meta={
            <InfoTip label="subscriber growth">
              Paid accounts at the start and end of the period, from recorded
              subscription history. Only periods that begin after history
              coverage started can be measured; nothing is reconstructed from
              current state.
            </InfoTip>
          }
        />
        {intel.history.status === "available" ? (
          <dl className={styles.miniStats}>
            <div>
              <dt>Paid accounts at start</dt>
              <dd>{number(intel.history.opening)}</dd>
            </div>
            <div>
              <dt>Gained</dt>
              <dd>+{number(intel.history.gained)}</dd>
            </div>
            <div>
              <dt>Lost</dt>
              <dd>−{number(intel.history.lost)}</dd>
            </div>
            <div>
              <dt>Paid accounts now</dt>
              <dd>{number(intel.history.closing)}</dd>
            </div>
          </dl>
        ) : (
          <>
            <StatusPill tone="warning">
              Not measurable for this period
            </StatusPill>
            <p className={styles.detail}>
              {intel.history.historyStart
                ? `Subscription history began ${timestamp(intel.history.historyStart)} UTC. Choose a period that starts after then (for example Today or 7 days once history is a week old).`
                : "Subscription history is not installed."}
            </p>
          </>
        )}
      </section>

      <section aria-labelledby="weekly-heading">
        <SectionHeading
          id="weekly-heading"
          title="Weekly trend"
          meta="12 ISO weeks (Monday start, UTC)"
        />
        <div className={styles.chartGrid}>
          {(
            [
              ["registrations", "Registrations"],
              ["trial_starts", "Trial starts"],
              ["new_paid", "New paid subscriptions"],
              ["cancellations", "Completed cancellations"],
            ] as const
          ).map(([key, title]) => (
            <BarTrend
              key={key}
              title={title}
              unit={title.toLowerCase()}
              points={intel.weekly[key].map((w) => ({
                day: w.week,
                value: w.value,
                partial: w.partial,
              }))}
              partialLabel="this week so far"
              partialAxis="This week (so far)"
              note="Each bar is a week starting Monday."
            />
          ))}
        </div>
      </section>

      <GrowthView overview={d} />
    </>
  );
}
