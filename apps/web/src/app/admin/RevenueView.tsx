import type { Overview } from "@/lib/admin/overview";
import type {
  CurrencyMoney,
  RevenueIntel,
  RevenueWindowIntel,
} from "@/lib/admin/intel/load";
import { formatMinor } from "@/lib/admin/finance";
import { compare } from "@/lib/admin/insights";
import {
  CoverageTag,
  Delta,
  InfoTip,
  number,
  SectionHeading,
  StatusPill,
  timestamp,
} from "./components";
import { ExportLink, NotInstalled, PeriodNote, PeriodTabs } from "./controls";
import { FinanceDetail, FinanceView } from "./FinanceView";
import styles from "./admin.module.css";

function WindowCard({ w }: { w: RevenueWindowIntel }) {
  const complete = w.coverage.status === "complete";
  return (
    <article className={styles.kpi}>
      <div className={styles.kpiHead}>
        <h3>{w.label}</h3>
        <CoverageTag complete={complete} />
      </div>
      {w.currencies.length ? (
        <ul className={styles.currencyList}>
          {w.currencies.map((c) => (
            <li key={c.currency}>
              <p className={styles.kpiValue}>
                {formatMinor(c.netMinor, c.currency)}
              </p>
              <p className={styles.detail}>
                {c.currency.toUpperCase()} net · {number(c.payments)} payment
                {c.payments === 1 ? "" : "s"}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.missing}>
          {complete ? "No recorded payments" : "No amounts recorded"}
        </p>
      )}
      {!complete && (
        <details className={styles.inlineDetails}>
          <summary>Why partial?</summary>
          {w.coverage.reasons.map((r) => (
            <p key={r} className={styles.detail}>
              {r}
            </p>
          ))}
        </details>
      )}
    </article>
  );
}

const ROWS: [string, (c: CurrencyMoney) => number, string][] = [
  [
    "Gross collected",
    (c) => c.grossMinor,
    "Successful invoice payments, including any tax, before Stripe fees.",
  ],
  [
    "  New subscription revenue",
    (c) => c.newMinor,
    "Invoices Stripe marks subscription_create.",
  ],
  [
    "  Renewal revenue",
    (c) => c.renewalMinor,
    "Invoices Stripe marks subscription_cycle.",
  ],
  [
    "  Other invoices",
    (c) => c.otherMinor,
    "For example plan-change prorations (subscription_update).",
  ],
  [
    "  Unclassified",
    (c) => c.unclassifiedMinor,
    "Recorded before new/renewal capture began.",
  ],
  [
    "  Monthly plan",
    (c) => c.monthlyMinor,
    "Attributed only when every priced line maps to the monthly Price.",
  ],
  [
    "  Annual plan",
    (c) => c.annualMinor,
    "Attributed only when every priced line maps to the annual Price.",
  ],
  ["Refunds (succeeded)", (c) => c.refundedMinor, "By refund date."],
  ["Lost disputes", (c) => c.disputesLostMinor, "By dispute creation date."],
  ["Net", (c) => c.netMinor, "Gross − refunds − lost disputes."],
];

export function RevenueView({
  overview: d,
  intel,
}: {
  overview: Overview;
  intel?: RevenueIntel;
}) {
  if (!intel || !d.finance)
    return (
      <>
        {!intel && <NotInstalled what="Period revenue intelligence" />}
        <FinanceView overview={d} />
      </>
    );
  const p = intel.period;
  const calendar = intel.windows.filter((w) =>
    ["today", "week", "month", "year", "lifetime"].includes(w.name),
  );
  const current = intel.windows.find((w) => w.name === "current")!;
  const previous = intel.windows.find((w) => w.name === "previous");
  const currencies = [
    ...new Set([
      ...current.currencies.map((c) => c.currency),
      ...(previous?.currencies.map((c) => c.currency) ?? []),
    ]),
  ].sort();
  const m = intel.mrr;
  return (
    <>
      <p className={styles.lede}>
        Ledger coverage began{" "}
        {intel.ledgerStart ? `${timestamp(intel.ledgerStart)} UTC` : "—"}. New
        vs renewal is recorded from{" "}
        {intel.billingReasonStart
          ? `${timestamp(intel.billingReasonStart)} UTC`
          : "—"}
        ; failed-payment values from{" "}
        {intel.failuresStart ? `${timestamp(intel.failuresStart)} UTC` : "—"}.
        Every amount is per currency; there is no consolidated total without an
        authoritative exchange rate.
        {d.finance.mode.testEntries > 0 &&
          d.finance.mode.liveEntries === 0 &&
          " All recorded amounts are Stripe TEST-mode sandbox data."}
      </p>
      <section aria-labelledby="calendar-heading">
        <SectionHeading
          id="calendar-heading"
          title="Net revenue"
          meta="UTC calendar windows · week starts Monday"
        />
        <div className={styles.kpiGrid5}>
          {calendar.map((w) => (
            <WindowCard key={w.name} w={w} />
          ))}
        </div>
      </section>

      <div className={styles.toolbar}>
        <PeriodTabs view="finance" period={p.id} />
        <ExportLink report="revenue" period={p.id} />
      </div>
      <PeriodNote
        label={p.label}
        start={p.start}
        compareLabel={p.compareLabel}
      />

      <section className={styles.panel} aria-labelledby="breakdown-heading">
        <SectionHeading
          id="breakdown-heading"
          title={`Revenue breakdown · ${p.label}`}
          meta={
            <CoverageTag complete={current.coverage.status === "complete"} />
          }
        />
        {currencies.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Measure</th>
                  {currencies.map((cur) => (
                    <th scope="col" key={cur}>
                      {cur.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([label, pick, def]) => (
                  <tr
                    key={label}
                    className={
                      label.startsWith("  ") ? styles.subRow : undefined
                    }
                  >
                    <th scope="row">
                      {label.trim()}
                      <span className={styles.srOnly}> — {def}</span>
                    </th>
                    {currencies.map((cur) => {
                      const now = current.currencies.find(
                        (c) => c.currency === cur,
                      );
                      const was = previous?.currencies.find(
                        (c) => c.currency === cur,
                      );
                      const value = now ? pick(now) : 0;
                      return (
                        <td key={cur}>
                          <strong>{formatMinor(value, cur)}</strong>
                          {label === "Net" && previous && (
                            <Delta
                              comparison={compare(value, was ? pick(was) : 0)}
                              period=""
                              against={p.compareLabel}
                              upIsGood
                              compact
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.missing}>
            {current.coverage.status === "complete"
              ? "No recorded payments in this period"
              : "No amounts recorded in this period"}
          </p>
        )}
        {current.coverage.reasons.map((r) => (
          <p key={r} className={styles.detail}>
            {r}
          </p>
        ))}
      </section>

      <div className={styles.split}>
        <section className={styles.panel} aria-labelledby="failed-value">
          <SectionHeading
            id="failed-value"
            title="Failed-payment value"
            meta={
              <InfoTip label="failed-payment value">
                Invoices with at least one failed attempt, by first failure in
                the period, valued at the invoice amount due. Recovered = the
                same invoice was later paid. Outstanding may still be retried by
                Stripe.
              </InfoTip>
            }
          />
          {current.failures.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Currency</th>
                    <th scope="col">Invoices</th>
                    <th scope="col">Failed value</th>
                    <th scope="col">Recovered</th>
                    <th scope="col">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {current.failures.map((f) => (
                    <tr key={f.currency}>
                      <th scope="row">{f.currency.toUpperCase()}</th>
                      <td>{number(f.invoices)}</td>
                      <td>{formatMinor(f.failedMinor, f.currency)}</td>
                      <td>{formatMinor(f.recoveredMinor, f.currency)}</td>
                      <td>{formatMinor(f.outstandingMinor, f.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.empty}>
              No failed invoices recorded in this period
              {intel.failuresStart && p.start && p.start < intel.failuresStart
                ? " since value capture began"
                : ""}
              .
            </p>
          )}
        </section>
        <section className={styles.panel} aria-labelledby="mrr-heading">
          <SectionHeading id="mrr-heading" title="Monthly recurring revenue" />
          {m.paying === 0 ? (
            <p className={styles.detail}>No active paid subscriptions.</p>
          ) : m.currencies.length ? (
            <ul className={styles.moneyList}>
              {m.currencies.map((cur) => (
                <li key={cur.currency}>
                  <strong>{formatMinor(cur.mrrMinor, cur.currency)}</strong>
                  <span>{cur.currency.toUpperCase()} MRR</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.detail}>
              Not yet available: no paying subscription has a recorded contract
              amount.
            </p>
          )}
          {m.status === "partial" && (
            <StatusPill tone="warning">
              Partial: {number(m.priced)} of {number(m.paying)} subscriptions
            </StatusPill>
          )}
          <p className={styles.detail}>
            List price × quantity, annual ÷ 12, excluding tax; discounted or
            unpriced subscriptions excluded. A current snapshot, not a trend.
          </p>
        </section>
      </div>

      <FinanceDetail overview={d} />
    </>
  );
}
