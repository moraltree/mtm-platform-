import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
vi.mock("server-only", () => ({}));
import { apply, loadMigrations } from "../../../scripts/lib/migrations.mjs";
import { database } from "@/lib/subscriptions/db";
import {
  EXPORTS_PER_HOUR,
  exportRateLimited,
  recordExportAudit,
} from "./exportAudit";
import { testSchemaName } from "../../../scripts/lib/testSchemas.mjs";

const url = process.env.MTM_ADMIN_TEST_DATABASE_URL;
describe.skipIf(!url)("export audit (disposable schema)", () => {
  const schema = testSchemaName("mtm_p5_audit_");
  const accountId = randomUUID();
  const saved = { ...process.env };
  beforeAll(async () => {
    const target = new URL(url!);
    if (
      !["localhost", "127.0.0.1"].includes(target.hostname) ||
      target.port !== "55439"
    )
      throw new Error("Unsafe database target");
    const c = new Client({
      connectionString: url,
      options: `-c search_path=${schema}`,
    });
    await c.connect();
    await c.query(`CREATE SCHEMA ${schema}`);
    await apply(c, await loadMigrations());
    await c.query(
      "INSERT INTO mtm_accounts(id,email,registration,trial_days) VALUES($1,'founder@example.invalid','{}',0)",
      [accountId],
    );
    await c.end();
    // The application pool reads search_path from PGOPTIONS at connect time.
    process.env.PGOPTIONS = `-c search_path=${schema}`;
    process.env.SUBSCRIPTIONS_ENABLED = "true";
    process.env.SUBSCRIPTIONS_DATABASE_URL = url;
  });
  afterAll(async () => {
    await database().end();
    process.env = saved;
    const c = new Client({ connectionString: url });
    await c.connect();
    await c.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await c.end();
  });

  const record = (outcome: "released" | "rate_limited" = "released") =>
    recordExportAudit({
      requestId: randomUUID(),
      accountId,
      role: "founder",
      report: "revenue",
      sensitivity: "aggregate",
      filters: { period: "30d" },
      outcome,
      rowCount: 4,
      byteCount: 512,
      contentSha256: "a".repeat(64),
    });

  it("appends metadata-only rows at the external threshold", async () => {
    await record();
    const rows = (
      await database().query(
        "SELECT actor_account_id,actor_role,report,sensitivity,filters,min_group,row_count,byte_count,outcome FROM mtm_admin_export_audit",
      )
    ).rows;
    expect(rows).toEqual([
      {
        actor_account_id: accountId,
        actor_role: "founder",
        report: "revenue",
        sensitivity: "aggregate",
        filters: { period: "30d" },
        min_group: 10,
        row_count: 4,
        byte_count: 512,
        outcome: "released",
      },
    ]);
    const columns = (
      await database().query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='mtm_admin_export_audit'",
      )
    ).rows.map((r) => r.column_name);
    // No column can hold exported content, email or a network address.
    for (const forbidden of ["content", "csv", "email", "ip", "user_agent"])
      expect(columns).not.toContain(forbidden);
  });

  it("rejects an unknown actor and cannot be altered afterwards", async () => {
    await expect(
      recordExportAudit({
        requestId: randomUUID(),
        accountId: randomUUID(),
        role: "founder",
        report: "revenue",
        sensitivity: "aggregate",
        filters: {},
        outcome: "released",
      }),
    ).rejects.toThrow();
    await expect(
      database().query("DELETE FROM mtm_admin_export_audit"),
    ).rejects.toThrow(/append-only/);
  });

  it("rate limits released exports per actor across instances", async () => {
    expect(await exportRateLimited(accountId)).toBe(false);
    await record("rate_limited"); // Refusals do not count towards the limit.
    for (let i = 1; i < EXPORTS_PER_HOUR; i++) await record();
    expect(await exportRateLimited(accountId)).toBe(true);
    expect(await exportRateLimited(randomUUID())).toBe(false);
  });
});
