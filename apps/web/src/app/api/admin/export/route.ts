import { createHash, randomUUID } from "node:crypto";
import { authorizeAdminActor } from "@/lib/admin/auth";
import { readConsole } from "@/lib/admin/console";
import {
  exportRateLimited,
  recordExportAudit,
  type ExportAuditRecord,
} from "@/lib/admin/exportAudit";
import { exportsEnabled } from "@/lib/admin/flags";
import {
  buildExport,
  EXPORT_REPORTS,
  parseReport,
  stepUpSatisfied,
} from "@/lib/admin/intel/exports";
import { parsePeriod } from "@/lib/admin/intel/periods";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

/**
 * Aggregate-only CSV, suppressed at the external minimum of 10.
 * Order: feature switch → authorization → allowlisted report → step-up →
 * rate limit → build → append-only audit row → release. If the audit row
 * cannot be written, nothing is released.
 */
export async function GET(request: Request) {
  // Default off: indistinguishable from a route that does not exist.
  if (!exportsEnabled())
    return Response.json({ error: "Not found" }, { status: 404, headers });
  let admin;
  try {
    admin = await authorizeAdminActor();
  } catch {
    return Response.json(
      { error: "Console unavailable" },
      { status: 503, headers },
    );
  }
  if (!admin)
    return Response.json({ error: "Access denied" }, { status: 403, headers });
  const params = new URL(request.url).searchParams;
  const report = parseReport(params.get("report"));
  if (!report)
    return Response.json({ error: "Unknown report" }, { status: 400, headers });
  const definition = EXPORT_REPORTS[report];
  const period = parsePeriod(params.get("period"));
  const requestId = randomUUID();
  const base: Omit<ExportAuditRecord, "outcome"> = {
    requestId,
    accountId: admin.accountId,
    role: admin.role,
    report,
    sensitivity: definition.sensitivity,
    filters: { period },
  };
  const refuse = async (
    outcome: ExportAuditRecord["outcome"],
    status: number,
    error: string,
  ) => {
    try {
      await recordExportAudit({ ...base, outcome });
    } catch {
      return Response.json(
        { error: "Export unavailable" },
        { status: 503, headers },
      );
    }
    return Response.json(
      { error },
      { status, headers: { ...headers, "X-Request-Id": requestId } },
    );
  };
  if (!stepUpSatisfied(definition.sensitivity))
    return refuse("step_up_required", 403, "Additional verification required");
  try {
    if (await exportRateLimited(admin.accountId))
      return refuse("rate_limited", 429, "Too many exports; try later");
  } catch {
    return Response.json(
      { error: "Export unavailable" },
      { status: 503, headers },
    );
  }
  const asOf = new Date();
  let csv: string | null;
  try {
    const data = await readConsole(definition.view, period, { now: asOf });
    csv = buildExport(report, data, asOf.toISOString());
  } catch {
    return refuse("unavailable", 503, "Console unavailable");
  }
  if (!csv) return refuse("unavailable", 409, "Report data unavailable");
  const bytes = Buffer.byteLength(csv, "utf8");
  try {
    await recordExportAudit({
      ...base,
      outcome: "released",
      // Data rows only: total lines minus the comment/meta and header lines.
      rowCount:
        csv.split("\r\n").filter((l) => l && !l.startsWith('"#')).length - 1,
      byteCount: bytes,
      contentSha256: createHash("sha256").update(csv).digest("hex"),
    });
  } catch {
    // Fail closed: an export that cannot be audited is not released.
    return Response.json(
      { error: "Export unavailable" },
      { status: 503, headers },
    );
  }
  return new Response(csv, {
    headers: {
      ...headers,
      "X-Request-Id": requestId,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mtm-${report}-${asOf.toISOString().slice(0, 10)}.csv"`,
    },
  });
}
