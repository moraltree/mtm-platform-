import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import {
  LEDGER,
  LOCK_KEY,
  apply,
  baseline,
  checksum,
  inspect,
  loadMigrations,
  runMigrationSql,
} from "../../../scripts/lib/migrations.mjs";
import { testSchemaName } from "../../../scripts/lib/testSchemas.mjs";

const url = process.env.MTM_ADMIN_TEST_DATABASE_URL;
type Migration = Awaited<ReturnType<typeof loadMigrations>>[number];

describe("migration file set", () => {
  it("loads 001 to 004 in order with stable checksums and explicit environment headers", async () => {
    const migrations = await loadMigrations();
    expect(migrations.map((m) => m.version)).toEqual([
      "001",
      "002",
      "003",
      "004",
    ]);
    for (const m of migrations) {
      expect(m.checksum).toBe(checksum(m.sql));
      expect(m.sql).not.toMatch(/dedicated TEST database/);
      expect(m.sql).toMatch(/Environments: every subscription database/);
      expect(m.sql).toMatch(/mtm\.migration_runner/);
      // The runner owns the transaction; files must not commit on their own.
      expect(m.sql).not.toMatch(/^\s*(BEGIN|COMMIT)\s*;/im);
    }
  });

  it("rejects unexpected names and version gaps", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mtm-migrations-"));
    try {
      const base = pathToFileURL(dir + "/");
      await writeFile(join(dir, "001_one.sql"), "SELECT 1;");
      await writeFile(join(dir, "003_three.sql"), "SELECT 1;");
      await expect(loadMigrations(base)).rejects.toThrow(/contiguous/);
      await rm(join(dir, "003_three.sql"));
      await writeFile(join(dir, "002-Bad.sql"), "SELECT 1;");
      await expect(loadMigrations(base)).rejects.toThrow(/Unexpected/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe.skipIf(!url)("migration runner (disposable schemas)", () => {
  const schemas: string[] = [];
  const clients: Client[] = [];
  afterEach(async () => {
    for (const c of clients.splice(0)) await c.end();
    const admin = new Client({ connectionString: url });
    await admin.connect();
    for (const s of schemas.splice(0))
      await admin.query(`DROP SCHEMA IF EXISTS ${s} CASCADE`);
    await admin.end();
  });
  async function fresh() {
    const target = new URL(url!);
    if (
      !["localhost", "127.0.0.1"].includes(target.hostname) ||
      target.port !== "55439"
    )
      throw new Error("Unsafe database target");
    const schema = testSchemaName("mtm_p5_migrate_");
    schemas.push(schema);
    const client = new Client({
      connectionString: url,
      options: `-c search_path=${schema}`,
    });
    clients.push(client);
    await client.connect();
    await client.query(`CREATE SCHEMA ${schema}`);
    return client;
  }
  const ledger = async (c: Client) =>
    (
      await c.query(
        `SELECT version,checksum,method FROM ${LEDGER} ORDER BY version`,
      )
    ).rows;
  const tables = async (c: Client) =>
    (
      await c.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() ORDER BY 1",
      )
    ).rows.map((r) => r.table_name);

  it("applies 001 to 004 once, verifies each, and records checksums", async () => {
    const c = await fresh();
    const migrations = await loadMigrations();
    expect(await apply(c, migrations)).toEqual(["001", "002", "003", "004"]);
    expect(await ledger(c)).toEqual(
      migrations.map((m) => ({
        version: m.version,
        checksum: m.checksum,
        method: "applied",
      })),
    );
    const state = await inspect(c, migrations);
    expect(state.pending).toEqual([]);
    expect(state.problems).toEqual([]);
    // Listening telemetry: schema present, coverage deliberately not started.
    expect(
      (
        await c.query("SELECT dataset FROM mtm_analytics_coverage ORDER BY 1")
      ).rows.map((r) => r.dataset),
    ).not.toContain("listening");
    expect(
      (await c.query("SELECT count(*)::int AS n FROM mtm_listening_events"))
        .rows[0].n,
    ).toBe(0);
  });

  it("is a no-op on re-run and each file is itself repeatable", async () => {
    const c = await fresh();
    const migrations = await loadMigrations();
    await apply(c, migrations);
    const before = await ledger(c);
    const coverage = (
      await c.query("SELECT * FROM mtm_analytics_coverage ORDER BY 1")
    ).rows;
    expect(await apply(c, migrations)).toEqual([]);
    for (const m of migrations) await runMigrationSql(c, m.sql);
    expect(await ledger(c)).toEqual(before);
    expect(
      (await c.query("SELECT * FROM mtm_analytics_coverage ORDER BY 1")).rows,
    ).toEqual(coverage);
  });

  it("applies incrementally with --through", async () => {
    const c = await fresh();
    const migrations = await loadMigrations();
    expect(await apply(c, migrations, { through: "002" })).toEqual([
      "001",
      "002",
    ]);
    expect(
      (await inspect(c, migrations)).pending.map((m: Migration) => m.version),
    ).toEqual(["003", "004"]);
    expect(await apply(c, migrations)).toEqual(["003", "004"]);
  });

  it("refuses direct execution outside the runner and creates nothing", async () => {
    const c = await fresh();
    const [first] = await loadMigrations();
    await expect(c.query(first.sql)).rejects.toThrow(/scripts\/migrate\.mjs/);
    expect(await tables(c)).toEqual([]);
  });

  it("fails closed on a changed checksum or an unknown applied version", async () => {
    const c = await fresh();
    const migrations = await loadMigrations();
    await apply(c, migrations, { through: "002" });
    const tampered: Migration[] = migrations.map((m) =>
      m.version === "002"
        ? { ...m, sql: m.sql + "\n-- edited", checksum: checksum(m.sql + "x") }
        : m,
    );
    await expect(apply(c, tampered)).rejects.toThrow(/Checksum mismatch/);
    expect(await tables(c)).not.toContain("mtm_payment_failures");
    await c.query(
      `INSERT INTO ${LEDGER}(version,name,checksum,method,runner) VALUES('009','ghost',$1,'applied','test')`,
      ["0".repeat(64)],
    );
    const state = await inspect(c, migrations);
    expect(state.problems.join()).toMatch(/009 has no migration file/);
    await expect(apply(c, migrations)).rejects.toThrow(/009/);
  });

  it("detects an unmanaged schema, refuses a false baseline, then adopts a verified one", async () => {
    const c = await fresh();
    const migrations = await loadMigrations();
    await runMigrationSql(c, migrations[0].sql); // Pre-ledger era: 001 only.
    const state = await inspect(c, migrations);
    expect(state.unmanaged).toBe(true);
    await expect(apply(c, migrations)).rejects.toThrow(/baseline required/);
    await expect(baseline(c, migrations, "003")).rejects.toThrow(
      /does not match 002/,
    );
    expect(await tables(c)).not.toContain(LEDGER); // Nothing half-recorded.
    await baseline(c, migrations, "001");
    expect((await ledger(c)).map((r) => r.method)).toEqual(["baseline"]);
    await expect(baseline(c, migrations, "001")).rejects.toThrow(
      /already exists/,
    );
    expect(await apply(c, migrations)).toEqual(["002", "003", "004"]);
  });

  it("rolls back only the failing migration and records nothing for it", async () => {
    const c = await fresh();
    const migrations = await loadMigrations();
    const broken: Migration[] = migrations.map((m) =>
      m.version === "003"
        ? {
            ...m,
            sql: "CREATE TABLE mtm_payment_failures(x int); SELECT 1/0;",
          }
        : m,
    );
    await expect(apply(c, broken)).rejects.toThrow(
      /003_analytics_intelligence\.sql failed and was rolled back/,
    );
    expect((await ledger(c)).map((r) => r.version)).toEqual(["001", "002"]);
    expect(await tables(c)).not.toContain("mtm_payment_failures");
  });

  it("rolls back a migration whose objects fail verification", async () => {
    const c = await fresh();
    const migrations = await loadMigrations();
    const hollow: Migration[] = migrations.map((m) =>
      m.version === "004" ? { ...m, sql: "SELECT 1;" } : m,
    );
    await expect(apply(c, hollow)).rejects.toThrow(/Verification failed/);
    expect((await ledger(c)).map((r) => r.version)).toEqual([
      "001",
      "002",
      "003",
    ]);
  });

  it("refuses to run concurrently", async () => {
    const c = await fresh();
    const other = await fresh();
    await other.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
    try {
      await expect(apply(c, await loadMigrations())).rejects.toThrow(/lock/);
      expect(await tables(c)).toEqual([]);
    } finally {
      await other.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
    }
  });

  it("keeps the migration ledger and export audit append-only", async () => {
    const c = await fresh();
    await apply(c, await loadMigrations());
    for (const sql of [
      `UPDATE ${LEDGER} SET name='x'`,
      `DELETE FROM ${LEDGER}`,
      `TRUNCATE ${LEDGER}`,
    ])
      await expect(c.query(sql)).rejects.toThrow(/append-only/);
    const id = randomUUID();
    await c.query(
      "INSERT INTO mtm_accounts(id,email,registration,trial_days) VALUES($1,'audit@example.invalid','{}',0)",
      [id],
    );
    await c.query(
      "INSERT INTO mtm_admin_export_audit(actor_account_id,actor_role,report,sensitivity,min_group,outcome) VALUES($1,'founder','revenue','aggregate',10,'released')",
      [id],
    );
    for (const sql of [
      "UPDATE mtm_admin_export_audit SET report='x'",
      "DELETE FROM mtm_admin_export_audit",
      "TRUNCATE mtm_admin_export_audit",
    ])
      await expect(c.query(sql)).rejects.toThrow(/append-only/);
    // The audit table refuses a threshold below the external minimum.
    await expect(
      c.query(
        "INSERT INTO mtm_admin_export_audit(actor_account_id,actor_role,report,sensitivity,min_group,outcome) VALUES($1,'founder','revenue','aggregate',5,'released')",
        [id],
      ),
    ).rejects.toThrow(/min_group/);
  });
});
