import type { CampaignIntel, ListeningIntel } from "@/lib/admin/intel/load";
import { share } from "@/lib/admin/insights";
import { number, percent, SectionHeading, StatusPill } from "./components";
import { NotInstalled, PeriodNote, PeriodTabs, viewHref } from "./controls";
import styles from "./admin.module.css";

export interface FunnelStage {
  id: string;
  label: string;
  /** null = not measurable: rendered as unavailable, never as zero. */
  value: number | null;
  source: string;
}

/** Founder funnel for accounts registered in the period, outcomes to date. */
export function funnelStages(
  totals: CampaignIntel["totals"],
  listening: ListeningIntel | undefined,
): FunnelStage[] {
  const listen = listening?.status === "available";
  return [
    {
      id: "visit",
      label: "Campaign visit",
      value: null,
      source:
        "Not recorded: landing visits are not stored server-side (attribution cookies only).",
    },
    {
      id: "registration",
      label: "Registration",
      value: totals.registrations,
      source: "Verified accounts created in the period.",
    },
    {
      id: "trial",
      label: "Trial started",
      value: totals.trials,
      source: "Recorded platform trial start with a positive length.",
    },
    {
      id: "first-listen",
      label: "First listen",
      value: null,
      source: listen
        ? "Listening telemetry is live but per-account first-listen linkage is not reported in aggregate yet."
        : "Awaiting approved listening telemetry.",
    },
    {
      id: "repeat-listen",
      label: "Repeat listen",
      value: null,
      source: listen
        ? "Listening telemetry is live but per-account repeat linkage is not reported in aggregate yet."
        : "Awaiting approved listening telemetry.",
    },
    {
      id: "paid",
      label: "Paid conversion",
      value: totals.paid,
      source:
        "A paid subscription confirmed at any time since registration (trial or direct).",
    },
    {
      id: "retained",
      label: "Retained subscriber",
      value: totals.payingNow,
      source: "Still holding paid access today.",
    },
  ];
}

export function FunnelView({
  campaigns,
  listening,
}: {
  campaigns?: CampaignIntel;
  listening?: ListeningIntel;
}) {
  if (!campaigns) return <NotInstalled what="The commercial funnel" />;
  const p = campaigns.period;
  const stages = funnelStages(campaigns.totals, listening);
  const base = campaigns.totals.registrations;
  const max = Math.max(1, ...stages.map((s) => s.value ?? 0));
  return (
    <>
      <div className={styles.toolbar}>
        <PeriodTabs view="funnel" period={p.id} />
      </div>
      <PeriodNote
        label={`Registered in ${p.label.toLowerCase()}`}
        start={p.start}
        compareLabel=""
      />
      <section className={styles.panel} aria-labelledby="funnel-heading">
        <SectionHeading
          id="funnel-heading"
          title="Visit → registration → trial → listen → paid → retained"
          meta={
            <a href={viewHref("campaigns", { period: p.id })}>By campaign →</a>
          }
        />
        <ol className={styles.funnel}>
          {stages.map((s) => (
            <li
              key={s.id}
              className={s.value === null ? styles.funnelOff : undefined}
            >
              <div className={styles.shareLabel}>
                <span>{s.label}</span>
                {s.value === null ? (
                  <StatusPill tone="neutral">Unavailable</StatusPill>
                ) : (
                  <strong>
                    {number(s.value)}
                    {s.id !== "registration" && (
                      <span className={styles.shareMeta}>
                        {" "}
                        · {percent(share(s.value, base))} of registrations
                      </span>
                    )}
                  </strong>
                )}
              </div>
              <div className={styles.shareTrack} aria-hidden="true">
                {s.value !== null && (
                  <span style={{ width: `${(s.value / max) * 100}%` }} />
                )}
              </div>
              <p className={styles.detail}>{s.source}</p>
            </li>
          ))}
        </ol>
        <p className={styles.detail}>
          A cohort view: accounts that registered in the period, followed to
          today. Recent registrations have had less time to convert. Stages that
          are not yet measured are shown as unavailable, never as zero.
        </p>
      </section>
    </>
  );
}
