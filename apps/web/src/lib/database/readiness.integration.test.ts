import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { Client, type QueryResult } from "pg";
import {
  apply,
  loadMigrations,
  runMigrationSql,
} from "../../../scripts/lib/migrations.mjs";
import { checkDatabase } from "../../../scripts/lib/readiness.mjs";
import { testSchemaName } from "../../../scripts/lib/testSchemas.mjs";
import { databaseConfig } from "./policy.mjs";

type Hook = (sql: string, real: Client) => Promise<void> | void;
/** A client whose statements are recorded and can be intercepted. */
function recording(real: Client, hook?: Hook) {
  const statements: string[] = [];
  const client = {
    query: async (sql: string, params?: unknown[]): Promise<QueryResult> => {
      statements.push(sql);
      await hook?.(sql, real);
      return real.query(sql, params);
    },
  } as unknown as Client;
  return { client, statements };
}

describe("checker configuration", () => {
  it("uses no startup options, which transaction-mode poolers reject", async () => {
    const script = await readFile(
      new URL("../../../scripts/check-subscriptions.mjs", import.meta.url),
      "utf8",
    );
    expect(script).not.toMatch(/options\s*:/);
    expect(script).not.toMatch(/default_transaction_read_only/);
    expect(script).toMatch(/checkDatabase\(/);
    expect(
      databaseConfig("postgresql://u@db.example.test/mtm?sslmode=verify-full", {
        env: {},
      }),
    ).not.toHaveProperty("options");
  });
});

const url = process.env.MTM_ADMIN_TEST_DATABASE_URL;
describe.skipIf(!url)("read-only readiness check (disposable schemas)", () => {
  const ready = testSchemaName("mtm_p5_ready_");
  const partial = testSchemaName("mtm_p5_partial_");
  const clients: Client[] = [];
  const connect = async (schema: string) => {
    const c = new Client({
      connectionString: url,
      options: `-c search_path=${schema}`,
    });
    clients.push(c);
    await c.connect();
    return c;
  };
  beforeAll(async () => {
    const target = new URL(url!);
    if (target.hostname !== "127.0.0.1" && target.hostname !== "localhost")
      throw new Error("Unsafe database target");
    const admin = await connect("public");
    await admin.query(`CREATE SCHEMA ${admin.escapeIdentifier(ready)}`);
    await admin.query(`CREATE SCHEMA ${admin.escapeIdentifier(partial)}`);
    const r = await connect(ready);
    await apply(r, await loadMigrations());
    await r.query(
      "INSERT INTO mtm_library(id,title,published,free_selection) SELECT 's'||n,'S'||n,true,true FROM generate_series(1,30) n",
    );
    const p = await connect(partial);
    await runMigrationSql(p, (await loadMigrations())[0].sql); // unmanaged
  });
  afterAll(async () => {
    const admin = clients[0];
    for (const s of [ready, partial])
      await admin.query(
        `DROP SCHEMA IF EXISTS ${admin.escapeIdentifier(s)} CASCADE`,
      );
    for (const c of clients) await c.end();
  });

  it("reports readiness inside one read-only transaction that always rolls back", async () => {
    const real = await connect(ready);
    const { client, statements } = recording(real);
    const result = await checkDatabase(client, await loadMigrations());
    expect(
      result.state.applied.map((r: { version: string }) => r.version),
    ).toEqual(["001", "002", "003", "004"]);
    expect(result.state.problems).toEqual([]);
    expect(result.freeSelection).toBe(30);
    expect(statements[0]).toBe("BEGIN READ ONLY");
    expect(statements.at(-1)).toBe("ROLLBACK");
    for (const sql of statements)
      expect(sql).not.toMatch(
        /\b(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE)\b/i,
      );
  });

  it("the server refuses any write inside the checker's transaction", async () => {
    const real = await connect(ready);
    let writeError = "";
    const { client } = recording(real, async (sql, c) => {
      if (sql === "SHOW transaction_read_only") {
        await c.query("SAVEPOINT probe");
        try {
          await c.query(
            "INSERT INTO mtm_library(id,title) VALUES('probe','probe')",
          );
        } catch (error) {
          writeError = (error as Error).message;
        }
        await c.query("ROLLBACK TO SAVEPOINT probe");
      }
    });
    await checkDatabase(client, await loadMigrations());
    expect(writeError).toMatch(/read-only transaction/);
    expect(
      (
        await real.query(
          "SELECT count(*)::int AS n FROM mtm_library WHERE id='probe'",
        )
      ).rows[0].n,
    ).toBe(0);
  });

  it("rolls back and leaves the connection clean when a check fails", async () => {
    const real = await connect(ready);
    const { client, statements } = recording(real, (sql) => {
      if (/FROM mtm_library/.test(sql)) throw new Error("simulated failure");
    });
    await expect(checkDatabase(client, await loadMigrations())).rejects.toThrow(
      /simulated failure/,
    );
    expect(statements.at(-1)).toBe("ROLLBACK");
    // Not left inside (or aborted in) a transaction.
    expect((await real.query("SELECT 1 AS ok")).rows[0].ok).toBe(1);
    expect(
      (await real.query("SHOW transaction_read_only")).rows[0]
        .transaction_read_only,
    ).toBe("off");
  });

  it("reports an unmanaged schema without querying further", async () => {
    const real = await connect(partial);
    const result = await checkDatabase(real, await loadMigrations());
    expect(result.state.unmanaged).toBe(true);
    expect(result.state.problems.join()).toMatch(/baseline required/);
    expect(result.freeSelection).toBeNull();
  });
});
