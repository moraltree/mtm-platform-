import { niceMax } from "@/lib/admin/insights";
import { number, shortDay } from "./components";
import styles from "./admin.module.css";

export interface BarPoint {
  day: string;
  value: number;
  /** Today's still-accumulating bucket: drawn lighter and labelled. */
  partial?: boolean;
  /** Outside data coverage: shaded background, no bar, never a zero claim. */
  uncovered?: boolean;
}

const W = 600;
const H = 150;
const TOP = 6;

/** Contiguous [from, to] index ranges of uncovered days, drawn as one seamless band each. */
function runs(points: BarPoint[]) {
  const out: [number, number][] = [];
  points.forEach((p, i) => {
    if (!p.uncovered) return;
    const last = out.at(-1);
    if (last && last[1] === i - 1) last[1] = i;
    else out.push([i, i]);
  });
  return out;
}

/** Column path: 4px rounded data end, square at the baseline. */
function column(x: number, width: number, height: number) {
  const base = H;
  const top = base - height;
  const r = Math.min(4, width / 2, height);
  return `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + width - r}Q${x + width},${top} ${x + width},${top + r}V${base}Z`;
}

/**
 * Single-series daily column chart, server-rendered SVG (no client script).
 * One hue, so no legend: the title names the series. Every value is also in
 * the data table; per-bar titles give a hover readout on pointer devices.
 */
export function BarTrend({
  title,
  points,
  format = number,
  unit,
  note,
  partialLabel = "today so far",
  partialAxis = "Today (so far)",
}: {
  title: string;
  points: BarPoint[];
  format?: (value: number) => string;
  unit: string;
  note?: string;
  /** How the still-accumulating last bucket is described (daily: "today so far"). */
  partialLabel?: string;
  partialAxis?: string;
}) {
  const covered = points.filter((p) => !p.uncovered);
  const total = covered.reduce((sum, p) => sum + p.value, 0);
  const max = niceMax(Math.max(0, ...covered.map((p) => p.value)));
  const peak = covered.reduce<BarPoint | null>(
    (best, p) => (p.value > 0 && (!best || p.value > best.value) ? p : best),
    null,
  );
  const slot = W / Math.max(points.length, 1);
  const barWidth = Math.min(14, slot - 4);
  const summary = `${title}: ${format(total)} ${unit} across ${covered.length} covered day${covered.length === 1 ? "" : "s"}${peak ? `, peak ${format(peak.value)} on ${shortDay(peak.day)}` : ""}.`;
  return (
    <figure className={styles.chart}>
      <figcaption className={styles.chartHead}>
        <strong>{title}</strong>
        <span>
          {format(total)} {unit}
          {peak && ` · peak ${format(peak.value)} (${shortDay(peak.day)})`}
        </span>
      </figcaption>
      <div className={styles.chartFrame}>
        <span className={styles.chartMax}>{format(max)}</span>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={styles.chartSvg}
          role="img"
          aria-label={summary}
          preserveAspectRatio="none"
        >
          <line x1="0" x2={W} y1={TOP} y2={TOP} className={styles.grid} />
          {runs(points).map(([from, to]) => (
            <rect
              key={points[from].day}
              x={from * slot}
              y={TOP}
              width={(to - from + 1) * slot}
              height={H - TOP}
              className={styles.uncovered}
            >
              <title>{`${shortDay(points[from].day)}–${shortDay(points[to].day)}: before data coverage`}</title>
            </rect>
          ))}
          {points.map((p, i) => {
            const height = (p.value / max) * (H - TOP);
            const x = i * slot + (slot - barWidth) / 2;
            return p.uncovered ? null : (
              <g key={p.day} className={styles.barGroup}>
                <rect
                  x={i * slot}
                  y={0}
                  width={slot}
                  height={H}
                  className={styles.hit}
                />
                {height > 0 && (
                  <path
                    d={column(x, barWidth, height)}
                    className={p.partial ? styles.barPartial : styles.bar}
                  />
                )}
                <title>{`${shortDay(p.day)}${p.partial ? ` (${partialLabel})` : ""}: ${format(p.value)} ${unit}`}</title>
              </g>
            );
          })}
          <line x1="0" x2={W} y1={H} y2={H} className={styles.axis} />
        </svg>
      </div>
      <div className={styles.chartAxis} aria-hidden="true">
        <span>{points[0] && shortDay(points[0].day)}</span>
        <span>
          {points.at(-1)?.partial
            ? partialAxis
            : points.at(-1) && shortDay(points.at(-1)!.day)}
        </span>
      </div>
      {note && <p className={styles.detail}>{note}</p>}
      <details className={styles.tableToggle}>
        <summary>Show data table</summary>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Date (UTC)</th>
                <th scope="col">{unit[0].toUpperCase() + unit.slice(1)}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.day}>
                  <th scope="row">
                    {shortDay(p.day)}
                    {p.partial ? " (so far)" : ""}
                  </th>
                  <td>{p.uncovered ? "Not covered" : format(p.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/** Tiny decorative trend for KPI tiles; the full chart/table carries values. */
export function Spark({ points }: { points: BarPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const slot = 100 / points.length;
  return (
    <svg
      viewBox="0 0 100 24"
      className={styles.spark}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <line x1="0" x2="100" y1="23.5" y2="23.5" className={styles.sparkBase} />
      {points.map((p, i) => {
        const h = (p.value / max) * 22;
        if (h <= 0) return null;
        return (
          <rect
            key={p.day}
            x={i * slot + slot * 0.15}
            y={24 - h}
            width={slot * 0.7}
            height={h}
            className={
              i === points.length - 1 ? styles.sparkNow : styles.sparkBar
            }
          />
        );
      })}
    </svg>
  );
}

/** Horizontal share bars (HTML) for funnels and splits; one hue, labelled values. */
export function ShareBars({
  rows,
  caption,
}: {
  rows: { label: string; value: number; share: number | null; note?: string }[];
  caption: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <figure className={styles.shareBars}>
      <figcaption className={styles.srOnly}>{caption}</figcaption>
      <ol>
        {rows.map((r) => (
          <li key={r.label}>
            <div className={styles.shareLabel}>
              <span>{r.label}</span>
              <strong>
                {number(r.value)}
                {r.share !== null && (
                  <span className={styles.shareMeta}> · {r.share}%</span>
                )}
              </strong>
            </div>
            <div className={styles.shareTrack} aria-hidden="true">
              <span style={{ width: `${(r.value / max) * 100}%` }} />
            </div>
            {r.note && <p className={styles.detail}>{r.note}</p>}
          </li>
        ))}
      </ol>
    </figure>
  );
}
