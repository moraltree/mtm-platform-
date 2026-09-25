import type { Overview } from "@/lib/admin/overview";
import type { Tone } from "./components";

/** Summary tone for ledger/reconciliation state, shared by Overview and Operations. */
export function healthTone(d: Overview): {
  ledger: { tone: Tone; label: string };
} {
  const f = d.finance;
  if (!f)
    return {
      ledger: { tone: "warning", label: "Payment ledger not installed" },
    };
  const lifetime = f.revenue.find((w) => w.period === "lifetime");
  const gaps = d.insights.openGaps ?? 0;
  if (gaps > 0)
    return {
      ledger: { tone: "warning", label: `${gaps} ledger gap(s) to review` },
    };
  if (lifetime?.coverage.status !== "complete")
    return {
      ledger: { tone: "warning", label: "Ledger coverage partial (history)" },
    };
  return { ledger: { tone: "good", label: "Ledger reconciled" } };
}
