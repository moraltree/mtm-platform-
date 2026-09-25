/**
 * MTM migration ledger and runner (Phase 5).
 *
 * - Every file in migrations/ named NNN_name.sql is one migration; versions
 *   must be contiguous from 001.
 * - Applied migrations are recorded in mtm_schema_migrations (version, name,
 *   SHA-256 checksum, method, time, database role, runner version, duration).
 * - Each migration runs in its own transaction together with its post-apply
 *   verification and its ledger row, so a migration is either fully applied
 *   and recorded, or not applied at all. Nothing is ever rolled back once
 *   committed; there is no automatic "down" migration.
 * - Fails closed on: an applied version with no file, a changed checksum, a
 *   gap in the applied sequence, an unmanaged pre-existing schema (unless it
 *   is explicitly baselined after object verification), or a concurrent run
 *   (session advisory lock).
 *
 * Plain JavaScript so it runs under plain Node (scripts/migrate.mjs) and in
 * the Vitest suite without a build step. It never prints connection strings.
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";

export const LEDGER = "mtm_schema_migrations";
export const RUNNER_VERSION = "mtm-migrate/1";
// Arbitrary constant key for pg_try_advisory_lock ("MTM" + migrations).
export const LOCK_KEY = 7_702_310_501;
const FILE = /^(\d{3})_([a-z0-9_]+)\.sql$/;

export class MigrationError extends Error {
  constructor(message) {
    super(message);
    this.name = "MigrationError";
  }
}

export const checksum = (sql) =>
  createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex");

/** Reads and validates the migration directory. */
export async function loadMigrations(
  dir = new URL("../../migrations/", import.meta.url),
) {
  const names = (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort();
  const migrations = [];
  for (const [index, file] of names.entries()) {
    const match = FILE.exec(file);
    if (!match) throw new MigrationError(`Unexpected migration file: ${file}`);
    const version = match[1];
    if (Number(version) !== index + 1)
      throw new MigrationError(
        `Migration versions must be contiguous from 001 (found ${file})`,
      );
    const sql = await readFile(new URL(file, dir), "utf8");
    migrations.push({
      version,
      name: match[2],
      file,
      sql,
      checksum: checksum(sql),
    });
  }
  if (!migrations.length) throw new MigrationError("No migrations found");
  return migrations;
}

const LEDGER_DDL = `CREATE TABLE IF NOT EXISTS ${LEDGER} (
  version text PRIMARY KEY CHECK (version ~ '^[0-9]{3}$'),
  name text NOT NULL,
  checksum text NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
  method text NOT NULL CHECK (method IN ('applied','baseline')),
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by text NOT NULL DEFAULT current_user,
  runner text NOT NULL,
  execution_ms integer CHECK (execution_ms >= 0)
);
CREATE OR REPLACE FUNCTION ${LEDGER}_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION '${LEDGER} is append-only'; END $$;
DROP TRIGGER IF EXISTS ${LEDGER}_no_change ON ${LEDGER};
CREATE TRIGGER ${LEDGER}_no_change BEFORE UPDATE OR DELETE ON ${LEDGER}
  FOR EACH ROW EXECUTE FUNCTION ${LEDGER}_append_only();
DROP TRIGGER IF EXISTS ${LEDGER}_no_truncate ON ${LEDGER};
CREATE TRIGGER ${LEDGER}_no_truncate BEFORE TRUNCATE ON ${LEDGER}
  FOR EACH STATEMENT EXECUTE FUNCTION ${LEDGER}_append_only();`;

/**
 * Object checks run after each migration (inside its transaction) and before
 * a baseline is recorded. They confirm the schema really is what the ledger
 * will claim; a failure aborts the transaction.
 */
const q = (sql) => sql;
export const VERIFY = {
  "001": q(`SELECT
    to_regclass('mtm_accounts') IS NOT NULL AND to_regclass('mtm_login_tokens') IS NOT NULL
    AND to_regclass('mtm_sessions') IS NOT NULL AND to_regclass('mtm_subscriptions') IS NOT NULL
    AND to_regclass('mtm_checkout_attempts') IS NOT NULL AND to_regclass('mtm_webhook_events') IS NOT NULL
    AND to_regclass('mtm_billing_events') IS NOT NULL AND to_regclass('mtm_library') IS NOT NULL AS ok`),
  "002": q(`SELECT
    to_regclass('mtm_analytics_coverage') IS NOT NULL AND to_regclass('mtm_ledger_entries') IS NOT NULL
    AND to_regclass('mtm_ledger_gaps') IS NOT NULL AND to_regclass('mtm_subscription_history') IS NOT NULL
    AND (SELECT count(*) FROM information_schema.columns WHERE table_schema=current_schema()
         AND table_name='mtm_subscriptions' AND column_name IN ('price_id','unit_amount_minor','currency',
         'billing_interval','interval_count','quantity','discounted','contract_recorded_at')) = 8
    AND (SELECT count(*) FROM mtm_analytics_coverage WHERE dataset IN
         ('payment_ledger','subscription_contracts','subscription_history')) = 3 AS ok`),
  "003": q(`SELECT
    to_regclass('mtm_payment_failures') IS NOT NULL AND to_regclass('mtm_listening_events') IS NOT NULL
    AND (SELECT count(*) FROM information_schema.columns WHERE table_schema=current_schema() AND (
         (table_name='mtm_ledger_entries' AND column_name='billing_reason') OR
         (table_name='mtm_library' AND column_name IN ('story_world','season')))) = 3
    AND (SELECT count(*) FROM pg_indexes WHERE schemaname=current_schema() AND indexname IN (
         'mtm_failures_first','mtm_listening_occurred','mtm_listening_story','mtm_billing_type_created',
         'mtm_billing_user_type','mtm_accounts_created','mtm_accounts_trial_start','mtm_webhook_processed')) = 8
    AND EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('mtm_analytics_coverage')
         AND conname='mtm_analytics_coverage_dataset_check' AND pg_get_constraintdef(oid) LIKE '%listening%')
    AND NOT EXISTS (SELECT 1 FROM mtm_analytics_coverage WHERE dataset='listening') AS ok`),
  "004": q(`SELECT
    to_regclass('mtm_admin_export_audit') IS NOT NULL
    AND (SELECT count(*) FROM pg_trigger WHERE tgrelid=to_regclass('mtm_admin_export_audit')
         AND tgname IN ('mtm_export_audit_no_change','mtm_export_audit_no_truncate')) = 2 AS ok`),
};

async function verified(client, version) {
  const sql = VERIFY[version];
  if (!sql) throw new MigrationError(`No verification defined for ${version}`);
  // Always called inside a transaction; a missing relation means "not
  // verified", not an aborted transaction.
  await client.query("SAVEPOINT mtm_verify");
  try {
    const ok = (await client.query(sql)).rows[0]?.ok === true;
    await client.query("RELEASE SAVEPOINT mtm_verify");
    return ok;
  } catch {
    await client.query("ROLLBACK TO SAVEPOINT mtm_verify");
    return false;
  }
}

/**
 * Runs one migration's SQL inside a caller-owned transaction with the guard
 * setting that the migration files require. Exported for tests that check
 * each file's own repeatability; production code goes through apply().
 */
export async function executeMigrationSql(client, sql) {
  await client.query("SELECT set_config('mtm.migration_runner','on',true)");
  await client.query(sql);
}

/** Runs executeMigrationSql in its own transaction (Pool or Client). */
export async function runMigrationSql(queryable, sql) {
  const pooled = typeof queryable.totalCount === "number";
  const client = pooled ? await queryable.connect() : queryable;
  try {
    await client.query("BEGIN");
    await executeMigrationSql(client, sql);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    if (pooled) client.release();
  }
}

/** Read-only inspection of the target against the known migrations. */
export async function inspect(client, migrations) {
  const target = (
    await client.query(
      `SELECT current_database() AS database, current_schema() AS schema,
        to_regclass('${LEDGER}') IS NOT NULL AS ledger,
        to_regclass('mtm_accounts') IS NOT NULL AS has_objects`,
    )
  ).rows[0];
  const applied = target.ledger
    ? (
        await client.query(
          `SELECT version,name,checksum,method,applied_at FROM ${LEDGER} ORDER BY version`,
        )
      ).rows
    : [];
  const problems = [];
  const known = new Map(migrations.map((m) => [m.version, m]));
  for (const [i, row] of applied.entries()) {
    const m = known.get(row.version);
    if (!m)
      problems.push(`Applied version ${row.version} has no migration file`);
    else if (m.checksum !== row.checksum)
      problems.push(`Checksum mismatch for applied migration ${m.file}`);
    if (row.version !== migrations[i]?.version)
      problems.push(
        `Applied migrations are not a contiguous prefix at ${row.version}`,
      );
  }
  const unmanaged = !target.ledger && target.has_objects;
  if (target.ledger && !applied.length && target.has_objects)
    problems.push(
      "Migration ledger is empty but subscription tables exist (inconsistent state)",
    );
  if (unmanaged)
    problems.push(
      "Subscription tables exist but the migration ledger does not (unmanaged schema; baseline required)",
    );
  const appliedVersions = new Set(applied.map((r) => r.version));
  return {
    database: target.database,
    schema: target.schema,
    ledger: target.ledger,
    unmanaged,
    applied,
    pending: migrations.filter((m) => !appliedVersions.has(m.version)),
    problems,
  };
}

async function withLock(client, work) {
  const got = (
    await client.query("SELECT pg_try_advisory_lock($1) AS ok", [LOCK_KEY])
  ).rows[0].ok;
  if (!got)
    throw new MigrationError("Another migration run holds the lock; stopping");
  try {
    return await work();
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
  }
}

async function ensureLedger(client) {
  await client.query("BEGIN");
  try {
    await client.query(LEDGER_DDL);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

/**
 * Applies pending migrations in order (optionally only through `through`).
 * Requires a dedicated single Client (a session advisory lock is held for the
 * run, so it must not go through a transaction-mode pooler).
 */
export async function apply(client, migrations, options = {}) {
  const log = options.log ?? (() => {});
  const lockTimeout = options.lockTimeoutMs ?? 5_000;
  const statementTimeout = options.statementTimeoutMs ?? 300_000;
  const selected = options.through
    ? migrations.filter((m) => m.version <= options.through)
    : migrations;
  return withLock(client, async () => {
    const before = await inspect(client, migrations);
    if (before.problems.length)
      throw new MigrationError(before.problems.join("; "));
    await ensureLedger(client);
    const done = new Set(before.applied.map((r) => r.version));
    const appliedNow = [];
    for (const m of selected) {
      if (done.has(m.version)) continue;
      const started = Date.now();
      await client.query("BEGIN");
      try {
        await client.query(`SET LOCAL lock_timeout = ${Number(lockTimeout)}`);
        await client.query(
          `SET LOCAL statement_timeout = ${Number(statementTimeout)}`,
        );
        await executeMigrationSql(client, m.sql);
        if (!(await verified(client, m.version)))
          throw new MigrationError(`Verification failed after ${m.file}`);
        await client.query(
          `INSERT INTO ${LEDGER}(version,name,checksum,method,runner,execution_ms) VALUES($1,$2,$3,'applied',$4,$5)`,
          [m.version, m.name, m.checksum, RUNNER_VERSION, Date.now() - started],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new MigrationError(
          `${m.file} failed and was rolled back: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
      appliedNow.push(m.version);
      log(`applied ${m.file}`);
    }
    return appliedNow;
  });
}

/**
 * Adopts a schema created before the ledger existed. Every version up to
 * `through` must pass its object verification against the live schema; the
 * ledger rows are then recorded with method 'baseline' in one transaction.
 * Refuses if a ledger already exists.
 */
export async function baseline(client, migrations, through) {
  if (!VERIFY[through] || !migrations.some((m) => m.version === through))
    throw new MigrationError(`Unknown baseline version ${through}`);
  return withLock(client, async () => {
    const state = await inspect(client, migrations);
    if (state.ledger)
      throw new MigrationError(
        "A migration ledger already exists; baseline refused",
      );
    if (!state.unmanaged)
      throw new MigrationError("No unmanaged schema found; use apply instead");
    // Ledger creation and every baseline row commit together or not at all.
    await client.query("BEGIN");
    try {
      await client.query(LEDGER_DDL);
      for (const m of migrations.filter((x) => x.version <= through)) {
        if (!(await verified(client, m.version)))
          throw new MigrationError(
            `Schema does not match ${m.file}; baseline refused`,
          );
        await client.query(
          `INSERT INTO ${LEDGER}(version,name,checksum,method,runner) VALUES($1,$2,$3,'baseline',$4)`,
          [m.version, m.name, m.checksum, RUNNER_VERSION],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}
