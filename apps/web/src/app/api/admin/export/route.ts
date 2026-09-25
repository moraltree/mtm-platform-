import { authorizeAdminActor } from "@/lib/admin/auth";
import { readConsole } from "@/lib/admin/console";
import {
  buildExport,
  EXPORT_REPORTS,
  parseReport,
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

/** Aggregate-only CSV. Same authorization as the console; every export is audit-logged. */
export async function GET(request: Request) {
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
  const period = parsePeriod(params.get("period"));
  const asOf = new Date();
  let csv: string | null;
  try {
    const data = await readConsole(EXPORT_REPORTS[report], period, {
      now: asOf,
    });
    csv = buildExport(report, data, asOf.toISOString());
  } catch {
    return Response.json(
      { error: "Console unavailable" },
      { status: 503, headers },
    );
  }
  if (!csv)
    return Response.json(
      { error: "Report data unavailable" },
      { status: 409, headers },
    );
  // Audit: pseudonymous actor reference, role, report and period only.
  console.info(
    JSON.stringify({
      event: "admin_export",
      at: asOf.toISOString(),
      actor: admin.actor,
      role: admin.role,
      report,
      period,
    }),
  );
  return new Response(csv, {
    headers: {
      ...headers,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mtm-${report}-${asOf.toISOString().slice(0, 10)}.csv"`,
    },
  });
}
