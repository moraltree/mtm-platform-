import { SectionHeading, StatusPill } from "./components";
import styles from "./admin.module.css";

/**
 * Future analytics areas. Deliberately static: no metric here is computed,
 * estimated or inferred. Each card states the source that would activate it.
 */
export const FUTURE_AREAS = [
  {
    id: "listening",
    title: "Listening behaviour",
    status: "No data source",
    today:
      "Audio requests are authorised per request but no playback events are stored.",
    requires:
      "A privacy-reviewed listening event stream (play, progress, completion) keyed to opaque account and story IDs, with retention rules.",
  },
  {
    id: "content",
    title: "Story & content performance",
    status: "No data source",
    today:
      "The library catalogue (published / curated flags) exists; per-story engagement does not.",
    requires:
      "The listening events above, joined to the stable library story IDs.",
  },
  {
    id: "campaigns",
    title: "Campaign attribution",
    status: "Captured, not modelled",
    today:
      "Server-resolved campaign and acquisition-source identifiers are stored at registration and copied onto billing events.",
    requires:
      "A reviewed attribution model (first- vs latest-touch, conversion window) and aggregate queries that suppress very small groups.",
  },
  {
    id: "partners",
    title: "Partner attribution",
    status: "Captured, not modelled",
    today:
      "An optional partner identifier travels with the registration record; it is not copied onto billing events or reported.",
    requires:
      "A partner dimension on campaigns plus the campaign attribution model above.",
  },
  {
    id: "vouchers",
    title: "Vouchers & QR campaigns",
    status: "No data source",
    today:
      "Reward eligibility is typed metadata only; no voucher is issued or redeemed, and QR scans are not persisted.",
    requires:
      "A voucher issuance/redemption ledger and a short-code scan event store.",
  },
  {
    id: "geography",
    title: "Geography",
    status: "No authoritative source",
    today:
      "Nothing is inferred from email, currency or campaign names; the optional registration country is self-declared.",
    requires:
      "An authoritative, consented country source (for example billing address or tax location) with recorded provenance.",
  },
  {
    id: "devices",
    title: "Devices",
    status: "No data source",
    today: "No device or client information is stored.",
    requires:
      "Consented client telemetry on listening events (device class only, no fingerprinting).",
  },
] as const;

export function RoadmapView() {
  return (
    <section aria-labelledby="future-heading">
      <SectionHeading
        id="future-heading"
        title="Future analytics"
        meta="Inactive until a data source exists"
      />
      <p className={styles.lede}>
        These areas are designed but switched off. Nothing below is estimated:
        each activates only once the named event or data source is recorded.
      </p>
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
  );
}
