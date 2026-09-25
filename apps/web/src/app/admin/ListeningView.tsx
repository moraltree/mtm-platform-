import type { ListeningIntel } from "@/lib/admin/intel/load";
import { share } from "@/lib/admin/insights";
import { ShareBars } from "./charts";
import {
  Kpi,
  number,
  percent,
  SectionHeading,
  StatusPill,
  timestamp,
} from "./components";
import { NotInstalled, PeriodNote, PeriodTabs } from "./controls";
import styles from "./admin.module.css";

export const LISTENING_METRICS = [
  "Most listened stories",
  "Most completed stories",
  "Most replayed stories",
  "Most popular Story Worlds",
  "Listening hours",
  "Average listening session",
  "Completion rate",
  "Listening by day",
  "Listening by hour",
  "Listening by subscription/trial status",
  "Sleep-timer use",
] as const;

const hours = (seconds: number) =>
  seconds >= 3600
    ? `${(seconds / 3600).toFixed(1)} h`
    : `${Math.round(seconds / 60)} min`;

export function ListeningView({ intel }: { intel?: ListeningIntel }) {
  if (!intel) return <NotInstalled what="Listening analytics" />;
  if (intel.status === "awaiting")
    return (
      <>
        <div className={styles.notice} role="note">
          <strong>Awaiting listening telemetry</strong>
          <p>
            No listening data is collected yet, so none is shown. The
            privacy-minimised event schema is installed; switching collection on
            is a separate, approved production change.
          </p>
        </div>
        <section aria-labelledby="planned-heading">
          <SectionHeading
            id="planned-heading"
            title="Ready to activate"
            meta="Each metric appears once telemetry is live"
          />
          <div className={styles.futureGrid}>
            {LISTENING_METRICS.map((m) => (
              <article key={m} className={styles.future}>
                <div className={styles.kpiHead}>
                  <h3>{m}</h3>
                  <StatusPill tone="neutral">Awaiting telemetry</StatusPill>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className={styles.panel} aria-labelledby="design-heading">
          <SectionHeading id="design-heading" title="Telemetry design" />
          <ul className={styles.plainList}>
            <li>
              Events: story started, progress (seconds listened since the last
              event), story completed, sleep timer set/ended.
            </li>
            <li>
              Stored: random per-playback session ID, story ID, coarse device
              class, occurred time, and a listener class (paid, trial or
              anonymous) derived on the server from the entitlement.
            </li>
            <li>
              Never stored: IP address, user agent, precise location, email,
              names, device fingerprints or free text.
            </li>
            <li>
              Retries are idempotent (session + sequence number); client clock
              skew and stale buffers are rejected.
            </li>
            <li>
              Story World and season come from the catalogue:{" "}
              {number(intel.storiesWithWorld)} of{" "}
              {number(intel.publishedStories)} published stories have a Story
              World assigned today.
            </li>
          </ul>
        </section>
      </>
    );
  const worlds = new Map<string, number>();
  for (const s of intel.stories)
    worlds.set(s.storyWorld, (worlds.get(s.storyWorld) ?? 0) + s.starts);
  const topBy = (key: "starts" | "completions" | "replays") =>
    [...intel.stories].sort((a, b) => b[key] - a[key]).slice(0, 5);
  return (
    <>
      <div className={styles.toolbar}>
        <PeriodTabs view="listening" period={intel.period.id} />
      </div>
      <PeriodNote
        label={intel.period.label}
        start={intel.period.start}
        compareLabel=""
      />
      <p className={styles.detail}>
        Listening telemetry recorded since {timestamp(intel.since)} UTC.
      </p>
      <div className={styles.kpiGrid}>
        <Kpi
          hero
          label="Listening hours"
          value={hours(intel.listenedSeconds)}
          definition="Sum of seconds listened reported by progress events."
        />
        <Kpi
          label="Average session"
          value={
            intel.sessions ? hours(intel.listenedSeconds / intel.sessions) : "—"
          }
          definition="Listening time ÷ distinct playback sessions."
        />
        <Kpi
          label="Completion rate"
          value={percent(share(intel.completions, intel.starts))}
          detail={`${number(intel.completions)} completions of ${number(intel.starts)} starts.`}
          definition="Story completed events ÷ story started events."
        />
        <Kpi
          label="Sleep timers"
          value={number(intel.sleepTimers)}
          definition="Sleep timers set in the period."
        />
      </div>
      <div className={styles.split}>
        {(
          [
            ["starts", "Most listened"],
            ["completions", "Most completed"],
            ["replays", "Most replayed"],
          ] as const
        ).map(([key, title]) => (
          <section key={key} className={styles.panel} aria-label={title}>
            <SectionHeading id={`top-${key}`} title={title} />
            <ol className={styles.plainList}>
              {topBy(key).map((s) => (
                <li key={s.storyId}>
                  {s.title}{" "}
                  <span className={styles.cellShare}>
                    · {s.storyWorld} · {number(s[key])}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ))}
        <section className={styles.panel} aria-label="Story Worlds">
          <SectionHeading id="top-worlds" title="Most popular Story Worlds" />
          <ol className={styles.plainList}>
            {[...worlds]
              .sort((a, b) => b[1] - a[1])
              .map(([world, starts]) => (
                <li key={world}>
                  {world}{" "}
                  <span className={styles.cellShare}>
                    · {number(starts)} starts
                  </span>
                </li>
              ))}
          </ol>
        </section>
      </div>
      <section className={styles.panel} aria-labelledby="hour-heading">
        <SectionHeading id="hour-heading" title="Listening by hour (UTC)" />
        <ShareBars
          caption="Minutes listened by hour of day, UTC"
          rows={intel.byHour.map((secs, h) => ({
            label: `${String(h).padStart(2, "0")}:00`,
            value: Math.round(secs / 60),
            share: share(secs, intel.listenedSeconds),
          }))}
        />
      </section>
      <section className={styles.panel} aria-labelledby="class-heading">
        <SectionHeading id="class-heading" title="By subscription status" />
        <ul className={styles.plainList}>
          {intel.byClass.map((c) => (
            <li key={c.listenerClass}>
              {c.listenerClass}: {number(c.sessions)} sessions ·{" "}
              {hours(c.listenedSeconds)}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
