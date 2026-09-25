import type { CoverageIntel } from "@/lib/admin/intel/load";
import type { CoverageStatus } from "@/lib/admin/intel/rules";
import { SectionHeading, StatusPill, timestamp, type Tone } from "./components";
import { ExportLink, NotInstalled } from "./controls";
import styles from "./admin.module.css";

/**
 * Areas still inactive after Phase 4. Static text only: nothing here is
 * computed, estimated or inferred. Each states what would activate it.
 */
export const FUTURE_AREAS = [
  {
    id: "listening",
    title: "Listening behaviour & content performance",
    status: "Schema ready",
    today:
      "The privacy-minimised listening event table exists but nothing writes to it.",
    requires:
      "Approval to enable telemetry from the audio player (privacy notice, retention period), then a coverage start is recorded.",
  },
  {
    id: "partners",
    title: "Partner attribution",
    status: "Captured, not validated",
    today:
      "An optional partner identifier travels with registration but can come from an editable form field.",
    requires:
      "Deriving the partner from the server-validated campaign configuration instead of the form.",
  },
  {
    id: "sources",
    title: "Landing source, QR codes & vouchers",
    status: "No trusted source",
    today:
      "Landing source can come from an editable field; QR scans and vouchers are not persisted.",
    requires:
      "A server-side short-code scan log and a voucher issuance/redemption ledger.",
  },
  {
    id: "visits",
    title: "Campaign visits",
    status: "No data source",
    today: "Landing visits are not stored server-side.",
    requires:
      "A consented, aggregate visit counter per campaign landing page (no personal identifiers).",
  },
  {
    id: "devices",
    title: "Devices",
    status: "Schema ready",
    today: "Only a coarse device class is designed into listening events.",
    requires: "The listening telemetry above.",
  },
] as const;

const tone: Record<CoverageStatus, Tone> = {
  available: "good",
  partial: "warning",
  unavailable: "neutral",
};
const word: Record<CoverageStatus, string> = {
  available: "Available",
  partial: "Partial",
  unavailable: "Unavailable",
};

export function CoverageView({ intel }: { intel?: CoverageIntel }) {
  return (
    <>
      <div className={styles.toolbar}>
        <p className={styles.lede}>
          What the console can and cannot tell you, and why. Unavailable never
          means zero activity.
        </p>
        {intel && <ExportLink report="coverage" />}
      </div>
      {intel ? (
        <section className={styles.panel} aria-labelledby="coverage-heading">
          <SectionHeading
            id="coverage-heading"
            title="Data coverage & quality"
            meta={
              <StatusPill tone={intel.sandbox ? "neutral" : "good"}>
                {intel.sandbox
                  ? "Test/sandbox money data"
                  : "Environment checked"}
              </StatusPill>
            }
          />
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Area</th>
                  <th scope="col">Status</th>
                  <th scope="col">Since</th>
                  <th scope="col">Source &amp; explanation</th>
                </tr>
              </thead>
              <tbody>
                {intel.domains.map((d) => (
                  <tr key={d.id}>
                    <th scope="row">{d.title}</th>
                    <td>
                      <StatusPill tone={tone[d.status]}>
                        {word[d.status]}
                      </StatusPill>
                    </td>
                    <td>{d.since ? timestamp(d.since) : "—"}</td>
                    <td className={styles.wrapCell}>
                      <strong>{d.source}.</strong> {d.detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.detail}>
            Available: measured from durable records for the whole period shown.
            Partial: real data with a stated gap (for example before a coverage
            start). Unavailable: no trustworthy source yet.
          </p>
        </section>
      ) : (
        <NotInstalled what="The data coverage inventory" />
      )}
      <section aria-labelledby="future-heading">
        <SectionHeading
          id="future-heading"
          title="Future analytics"
          meta="Inactive until a data source exists"
        />
        <div className={styles.futureGrid}>
          {FUTURE_AREAS.map((area) => (
            <article
              key={area.id}
              className={styles.future}
              aria-labelledby={`future-${area.id}`}
            >
              <div className={styles.kpiHead}>
                <h3 id={`future-${area.id}`}>{area.title}</h3>
                <StatusPill tone="neutral">{area.status}</StatusPill>
              </div>
              <p className={styles.missing}>Not yet available</p>
              <dl>
                <dt>Today</dt>
                <dd>{area.today}</dd>
                <dt>Required to activate</dt>
                <dd>{area.requires}</dd>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
