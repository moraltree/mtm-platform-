import "server-only";
import { database } from "@/lib/subscriptions/db";
import { EXPORT_MIN_GROUP } from "./intel/rules";
import type { ExportSensitivity } from "./intel/exports";
import type { AdminRole } from "./policy";

/** Released exports allowed per actor per rolling hour. */
export const EXPORTS_PER_HOUR = 20;

export type ExportOutcome =
  "released" | "unavailable" | "rate_limited" | "step_up_required";

export interface ExportAuditRecord {
  requestId: string;
  accountId: string;
  role: AdminRole;
  report: string;
  sensitivity: ExportSensitivity;
  /** Allowlisted, already-validated parameters only (never free text). */
  filters: { period?: string };
  outcome: ExportOutcome;
  rowCount?: number;
  byteCount?: number;
  contentSha256?: string;
}

/**
 * Appends one row to mtm_admin_export_audit (migration 004). Throws on
 * failure: callers must refuse the export rather than release it unaudited.
 * Stores metadata only; exported content is represented by its SHA-256.
 */
export async function recordExportAudit(r: ExportAuditRecord): Promise<void> {
  await database().query(
    `INSERT INTO mtm_admin_export_audit(request_id,actor_account_id,actor_role,report,sensitivity,filters,
      min_group,row_count,byte_count,content_sha256,outcome) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      r.requestId,
      r.accountId,
      r.role,
      r.report,
      r.sensitivity,
      JSON.stringify(r.filters),
      EXPORT_MIN_GROUP,
      r.rowCount ?? null,
      r.byteCount ?? null,
      r.contentSha256 ?? null,
      r.outcome,
    ],
  );
}

/** DB-backed, so the limit holds across serverless instances. */
export async function exportRateLimited(accountId: string): Promise<boolean> {
  const result = await database().query<{ n: number }>(
    `SELECT count(*)::int AS n FROM mtm_admin_export_audit
     WHERE actor_account_id=$1 AND outcome='released' AND occurred_at > now() - interval '1 hour'`,
    [accountId],
  );
  return (result.rows[0]?.n ?? 0) >= EXPORTS_PER_HOUR;
}
