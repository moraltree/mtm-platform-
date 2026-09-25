/**
 * Disposable test-schema ownership (Phase 5, review finding B1).
 *
 * The loopback test cluster is shared by concurrent sessions and worktrees.
 * A schema may be dropped by a cleanup step only when its NAME proves it was
 * created by the current run:
 *
 *   <prefix>r<16 hex run tag>_<16 hex random>     e.g. mtm_p5_audit_r0123…_89ab…
 *
 * The run tag comes from MTM_TEST_RUN_ID (set by the guarded runner). Without
 * a runner, each process gets its own random tag, so it still never matches
 * another run. Ownership is an exact full-name match, never a substring or
 * prefix match. Everything else — other runs' schemas, manual schemas,
 * `public` — is reported and never dropped. Identifiers are always quoted.
 */
import { randomBytes } from "node:crypto";

const PREFIX = /^mtm_[a-z0-9_]*_$/;
let processTag;

/**
 * "r" + first 16 hex digits of a UUID run ID.
 * @param {string} runId
 * @returns {string}
 */
export function runTag(runId) {
  const hex = String(runId ?? "")
    .replaceAll("-", "")
    .toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) throw new Error("Invalid test run ID");
  return `r${hex.slice(0, 16)}`;
}

/**
 * The tag for this process: the guarded runner's, or a private random one.
 * @param {Record<string, string | undefined>} [env]
 * @returns {string}
 */
export function currentRunTag(
  env = /** @type {Record<string, string | undefined>} */ (process.env),
) {
  if (env.MTM_TEST_RUN_ID) return runTag(env.MTM_TEST_RUN_ID);
  return (processTag ??= `r${randomBytes(8).toString("hex")}`);
}

/**
 * A new schema name owned by the current run.
 * @param {string} prefix
 * @param {string} [tag]
 * @returns {string}
 */
export function testSchemaName(prefix, tag = currentRunTag()) {
  if (!PREFIX.test(prefix)) throw new Error("Invalid test schema prefix");
  if (!/^r[0-9a-f]{16}$/.test(tag)) throw new Error("Invalid run tag");
  const name = `${prefix}${tag}_${randomBytes(8).toString("hex")}`;
  if (name.length > 63) throw new Error("Test schema name too long");
  return name;
}

/**
 * Exact ownership test: the whole name must match this run's pattern.
 * @param {string} name
 * @param {string} tag
 * @returns {boolean}
 */
export function isOwnedSchema(name, tag) {
  if (!/^r[0-9a-f]{16}$/.test(tag)) return false;
  return new RegExp(`^mtm_[a-z0-9_]*_${tag}_[0-9a-f]{16}$`).test(name);
}

/**
 * @param {import("pg").ClientBase} client
 * @returns {Promise<string[]>}
 */
export async function listSchemas(client) {
  return (
    await client.query(
      "SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg\\_%' AND nspname <> 'information_schema' ORDER BY 1",
    )
  ).rows.map((/** @type {{ nspname: string }} */ r) => r.nspname);
}

/**
 * Drops only schemas owned by `tag` (quoted, CASCADE). Every other schema
 * that appeared since `before` is returned in `foreign` for reporting only.
 * @param {import("pg").ClientBase} client
 * @param {string} tag
 * @param {Set<string>} [before]
 * @returns {Promise<{ dropped: string[], foreign: string[] }>}
 */
export async function cleanupRunSchemas(client, tag, before = new Set()) {
  /** @type {string[]} */
  const dropped = [];
  /** @type {string[]} */
  const foreign = [];
  for (const name of await listSchemas(client)) {
    if (isOwnedSchema(name, tag)) {
      await client.query(
        `DROP SCHEMA IF EXISTS ${client.escapeIdentifier(name)} CASCADE`,
      );
      dropped.push(name);
    } else if (!before.has(name)) {
      foreign.push(name);
    }
  }
  return { dropped, foreign };
}
