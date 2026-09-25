import type {
  AudienceIntel,
  CampaignIntel,
  CampaignRow,
  ListeningIntel,
} from "@/lib/admin/intel/load";
import { MIN_GROUP } from "@/lib/admin/intel/rules";
import { share } from "@/lib/admin/insights";
import { formatMinor } from "@/lib/admin/finance";
import { ShareBars } from "./charts";
import { number, percent, SectionHeading, StatusPill } from "./components";
import {
  ExportLink,
  NotInstalled,
  PeriodNote,
  PeriodTabs,
  viewHref,
} from "./controls";
import { funnelStages } from "./FunnelView";
import styles from "./admin.module.css";

const revenue = (r: CampaignRow) =>
  r.revenue.length
    ? r.revenue.map((m) => formatMinor(m.netMinor, m.currency)).join(" · ")
    : "No ledger payments recorded";

export function CampaignsView({
  intel,
  listening,
}: {
  intel?: CampaignIntel;
  listening?: ListeningIntel;
}) {
  if (!intel) return <NotInstalled what="Campaign analytics" />;
  const p = intel.period;
  const sel = intel.selected;
  return (
    <>
      <div className={styles.toolbar}>
        <PeriodTabs
          view="campaigns"
          period={p.id}
          extra={{ campaign: sel?.key }}
        />
        <ExportLink report="campaigns" period={p.id} />
      </div>
      <PeriodNote
        label={`Registered in ${p.label.toLowerCase()}`}
        start={p.start}
        compareLabel=""
      />
      <div className={styles.notice} role="note">
        <strong>Attribution rule</strong>
        <p>
          Accounts are attributed only to the campaign ID validated on the
          server when they registered. Partner and landing-source values can
          come from editable form fields, so they are not reported. Campaigns
          with fewer than {MIN_GROUP} registrations are grouped. Visits, first
          listens and repeat listeners are not yet recorded.
        </p>
      </div>
      {sel && (
        <section className={styles.panel} aria-labelledby="campaign-detail">
          <SectionHeading
            id="campaign-detail"
            title={`Campaign · ${sel.label}`}
            meta={
              <a href={viewHref("campaigns", { period: p.id })}>
                All campaigns
              </a>
            }
          />
          <ShareBars
            caption={`Funnel for campaign ${sel.label}`}
            rows={funnelStages(sel, listening)
              .filter((s) => s.value !== null)
              .map((s) => ({
                label: s.label,
                value: s.value!,
                share: share(s.value!, sel.registrations),
              }))}
          />
          <p className={styles.detail}>
            Attributed net revenue to date: {revenue(sel)}. Visits and listening
            stages are unavailable.
          </p>
        </section>
      )}
      <section className={styles.panel} aria-labelledby="campaigns-heading">
        <SectionHeading
          id="campaigns-heading"
          title="Campaign performance"
          meta={`${number(intel.totals.registrations)} registrations`}
        />
        {intel.rows.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Campaign</th>
                  <th scope="col">Registrations</th>
                  <th scope="col">Trial starts</th>
                  <th scope="col">Trial conversions</th>
                  <th scope="col">Paid</th>
                  <th scope="col">Paid rate</th>
                  <th scope="col">Paying now</th>
                  <th scope="col">Attributed net revenue</th>
                </tr>
              </thead>
              <tbody>
                {intel.rows.map((r) => (
                  <tr key={r.key}>
                    <th scope="row">
                      {r.kind === "campaign" ? (
                        <a
                          href={viewHref("campaigns", {
                            period: p.id,
                            campaign: r.key,
                          })}
                          aria-current={sel?.key === r.key ? "true" : undefined}
                        >
                          {r.label}
                        </a>
                      ) : (
                        r.label
                      )}
                    </th>
                    <td>{number(r.registrations)}</td>
                    <td>{number(r.trials)}</td>
                    <td>{number(r.converted)}</td>
                    <td>{number(r.paid)}</td>
                    <td>{percent(share(r.paid, r.registrations))}</td>
                    <td>{number(r.payingNow)}</td>
                    <td>{revenue(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.empty}>No registrations in this period.</p>
        )}
        <p className={styles.detail}>
          Revenue: net ledger payments (to date) from accounts registered under
          each campaign, per currency. Payments made before ledger coverage are
          not included.
        </p>
      </section>
    </>
  );
}

export function AudienceView({ intel }: { intel?: AudienceIntel }) {
  if (!intel) return <NotInstalled what="Geographic reporting" />;
  const p = intel.period;
  const declared = intel.total - intel.notProvided;
  return (
    <>
      <div className={styles.toolbar}>
        <PeriodTabs view="audience" period={p.id} />
      </div>
      <PeriodNote
        label={`Registered in ${p.label.toLowerCase()}`}
        start={p.start}
        compareLabel=""
      />
      <div className={styles.notice} role="note">
        <strong>Provenance: self-declared registration country</strong>
        <p>
          Country is optional and entered by the adult at registration; it is
          not verified. It is never inferred from email, currency, campaign or
          IP address. Only codes on the site’s country list are shown; countries
          with fewer than {MIN_GROUP} registrations are grouped. Region and city
          are not collected.
        </p>
      </div>
      <section className={styles.panel} aria-labelledby="country-heading">
        <SectionHeading
          id="country-heading"
          title="Registrations by declared country"
          meta={
            <StatusPill tone={declared ? "warning" : "neutral"}>
              {percent(share(declared, intel.total))} declared
            </StatusPill>
          }
        />
        {intel.rows.length || intel.grouped ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Country</th>
                  <th scope="col">Registrations</th>
                  <th scope="col">Share of declared</th>
                  <th scope="col">Paying now</th>
                </tr>
              </thead>
              <tbody>
                {intel.rows.map((r) => (
                  <tr key={r.code}>
                    <th scope="row">{r.name}</th>
                    <td>{number(r.registrations)}</td>
                    <td>{percent(share(r.registrations, declared))}</td>
                    <td>{number(r.payingNow)}</td>
                  </tr>
                ))}
                {intel.grouped && (
                  <tr>
                    <th scope="row">
                      {number(intel.grouped.countries)} smaller countries (fewer
                      than {MIN_GROUP} each)
                    </th>
                    <td>{number(intel.grouped.registrations)}</td>
                    <td>
                      {percent(share(intel.grouped.registrations, declared))}
                    </td>
                    <td>{number(intel.grouped.payingNow)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.empty}>
            No declared countries for registrations in this period.
          </p>
        )}
        <p className={styles.detail}>
          Not provided: {number(intel.notProvided)} · Unrecognised values:{" "}
          {number(intel.unrecognised)} · Total registrations:{" "}
          {number(intel.total)}.
        </p>
      </section>
    </>
  );
}
