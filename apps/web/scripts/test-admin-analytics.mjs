/** Run all web regressions without resetting retained Stripe sandbox acceptance data. */
import { Client } from "pg";
import { randomUUID, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  cleanupRunSchemas,
  listSchemas,
  runTag,
  testSchemaName,
} from "./lib/testSchemas.mjs";
const value = process.env.MTM_TEST_DATABASE_URL;
if (!value)
  throw new Error(
    "Set MTM_TEST_DATABASE_URL to the isolated local subscription test database",
  );
const url = new URL(value);
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  url.port !== "55439" ||
  url.pathname !== "/mtm_subscription_test"
)
  throw new Error("Unsafe test database target");
const db = new Client({
  connectionString: value,
  options: "-c search_path=public",
});
// Phase 5: every process started by this run carries this marker, so any
// survivor after the run can be identified precisely (never touching
// processes that existed before, e.g. long-running dev servers). The same
// ID tags every schema this run creates (scripts/lib/testSchemas.mjs): only
// schemas whose full name carries this run's tag may ever be dropped.
const runId = randomUUID();
const tag = runTag(runId);
const schema = testSchemaName("mtm_admin_regression_", tag);
const tables = [
  "mtm_accounts",
  "mtm_sessions",
  "mtm_login_tokens",
  "mtm_subscriptions",
  "mtm_checkout_attempts",
  "mtm_webhook_events",
  "mtm_billing_events",
  "mtm_library",
  // Phase 2 tables: absent from the retained public data today; fingerprinted if ever added.
  "mtm_analytics_coverage",
  "mtm_ledger_entries",
  "mtm_ledger_gaps",
  "mtm_subscription_history",
  // Phase 4 tables, likewise fingerprinted if ever present in public.
  "mtm_payment_failures",
  "mtm_listening_events",
  // Phase 5 tables, likewise.
  "mtm_admin_export_audit",
  "mtm_schema_migrations",
];
async function fingerprint(list) {
  const hash = createHash("sha256");
  for (const table of list) {
    const exists = (
      await db.query("SELECT to_regclass($1) AS name", ["public." + table])
    ).rows[0].name;
    hash.update(table);
    if (exists)
      hash.update(
        JSON.stringify(
          (
            await db.query(
              `SELECT row_to_json(t)::text AS row FROM public.${table} t ORDER BY row_to_json(t)::text`,
            )
          ).rows,
        ),
      );
  }
  return hash.digest("hex");
}
// Phase 5: also every table in public (the original list omits some
// retained tables), so any write anywhere in public is detected.
const publicTables = async () =>
  (
    await db.query(
      "SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND relkind='r' ORDER BY relname",
    )
  ).rows.map((r) => r.relname);

/** Live processes whose environment carries this run's marker. */
async function survivors() {
  const found = [];
  for (const pid of await readdir("/proc")) {
    if (!/^\d+$/.test(pid) || Number(pid) === process.pid) continue;
    try {
      const environ = await readFile(`/proc/${pid}/environ`, "utf8");
      if (environ.split("\0").includes(`MTM_TEST_RUN_ID=${runId}`))
        found.push(Number(pid));
    } catch {
      // Not ours / already gone.
    }
  }
  return found;
}

await db.connect();
const before = await fingerprint(tables);
const beforePublic = await fingerprint(await publicTables());
const schemasBefore = new Set(await listSchemas(db));
let code = 1;
let child;
const stopChild = () => {
  // Negative PID: the whole process group started for this run.
  if (child?.pid)
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      // Group already gone.
    }
};
process.once("SIGINT", stopChild);
process.once("SIGTERM", stopChild);
try {
  await db.query(`CREATE SCHEMA ${db.escapeIdentifier(schema)}`);
  const env = {
    ...process.env,
    PGOPTIONS: `-c search_path=${schema}`,
    MTM_TEST_DATABASE_URL: value,
    MTM_ADMIN_TEST_DATABASE_URL: value,
    MTM_TEST_RUN_ID: runId,
  };
  for (const key of Object.keys(env))
    if (
      /^(STRIPE_|RESEND_|LIBRARY_AUDIO_|ADMIN_ACCOUNT_ROLES|ADMIN_EXPORTS_ENABLED|LISTENING_TELEMETRY_ENABLED|MTM_MIGRATION_DATABASE)/.test(
        key,
      )
    )
      delete env[key];
  code = await new Promise((resolve, reject) => {
    child = spawn("npm", ["run", "test"], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env,
      stdio: "inherit",
      detached: true, // Own process group, so stragglers can be stopped together.
    });
    child.once("error", reject);
    child.once("exit", (result) => resolve(result ?? 1));
  });
} finally {
  stopChild();
  const orphans = await survivors();
  for (const pid of orphans)
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Exited meanwhile.
    }
  // Drops only schemas carrying this run's tag (including the regression
  // schema). New schemas from anyone else are reported, never dropped.
  const { dropped, foreign } = await cleanupRunSchemas(db, tag, schemasBefore);
  const leftByTests = dropped.filter((s) => s !== schema);
  for (const s of foreign)
    console.warn(`Not owned by this run, left untouched: ${s}`);
  const after = await fingerprint(tables);
  const afterPublic = await fingerprint(await publicTables());
  await db.end();
  if (before !== after || beforePublic !== afterPublic)
    throw new Error("Retained public acceptance data changed");
  if (orphans.length)
    throw new Error(`${orphans.length} test process(es) outlived the run`);
  if (leftByTests.length)
    throw new Error(
      `${leftByTests.length} schema(s) owned by this run were left by tests (now removed)`,
    );
  console.log(
    `Retained Stripe acceptance tables unchanged (runner ${after.slice(0, 12)}, public ${afterPublic.slice(0, 12)}); ` +
      "this run's schemas removed (no others touched); no orphan processes.",
  );
}
process.exitCode = code;
