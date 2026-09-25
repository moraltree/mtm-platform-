/**
 * Read-only database readiness check (Phase 5, review finding C1).
 *
 * Runs entirely inside one explicit `BEGIN READ ONLY` transaction instead of
 * a `-c default_transaction_read_only=on` startup option: transaction-mode
 * poolers (PgBouncer, Neon's pooler) reject startup options, and the checker
 * connects through the application's pooled SUBSCRIPTIONS_DATABASE_URL.
 * The transaction's read-only state is confirmed from the server before any
 * query, and it always ends in ROLLBACK, so nothing can be written.
 */
import { inspect } from "./migrations.mjs";

/**
 * @param {import("pg").ClientBase} client
 * @param {Awaited<ReturnType<typeof import("./migrations.mjs").loadMigrations>>} migrations
 */
export async function checkDatabase(client, migrations) {
  await client.query("BEGIN READ ONLY");
  try {
    const mode = (await client.query("SHOW transaction_read_only")).rows[0]
      ?.transaction_read_only;
    if (mode !== "on")
      throw new Error(
        "Readiness check could not start a read-only transaction",
      );
    const state = await inspect(client, migrations);
    let freeSelection = null;
    if (!state.pending.length && !state.problems.length)
      freeSelection = (
        await client.query(
          "SELECT count(*)::int AS count FROM mtm_library WHERE published=true AND free_selection=true",
        )
      ).rows[0].count;
    return { state, freeSelection };
  } finally {
    // Always end the transaction, including after an error, so a pooled
    // server connection is never returned mid-transaction.
    await client.query("ROLLBACK");
  }
}
