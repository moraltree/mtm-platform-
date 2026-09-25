import { afterAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { Client } from "pg";
import {
  cleanupRunSchemas,
  currentRunTag,
  isOwnedSchema,
  listSchemas,
  runTag,
  testSchemaName,
} from "../../../scripts/lib/testSchemas.mjs";

const hex16 = () => randomBytes(8).toString("hex");

describe("test schema ownership rules", () => {
  const tag = runTag(randomUUID());
  it("derives a fixed-format tag and names schemas with it", () => {
    expect(tag).toMatch(/^r[0-9a-f]{16}$/);
    expect(() => runTag("not-a-uuid")).toThrow();
    const name = testSchemaName("mtm_p5_x_", tag);
    expect(name).toMatch(new RegExp(`^mtm_p5_x_${tag}_[0-9a-f]{16}$`));
    expect(isOwnedSchema(name, tag)).toBe(true);
    // The guarded runner's tag is used when present.
    const id = randomUUID();
    expect(currentRunTag({ MTM_TEST_RUN_ID: id })).toBe(runTag(id));
  });
  it("rejects prefixes that are not plain lower-case identifiers", () => {
    for (const bad of ["public_", "mtm_x", 'mtm_"x_', "mtm_x;drop_", "MTM_X_"])
      expect(() => testSchemaName(bad, tag)).toThrow(/prefix/);
  });
  it("matches only the exact full name, never a prefix or substring", () => {
    const other = runTag(randomUUID());
    const h = hex16();
    for (const name of [
      `mtm_p5_x_${other}_${h}`, // another run
      "public",
      "mtm_manual_leftover",
      `x_mtm_p5_${tag}_${h}`, // does not start with mtm_
      `mtm_p5_x_${tag}_${h}x`, // trailing text
      `mtm_p5_x_${tag}_${h}"; DROP SCHEMA public CASCADE; --`,
      `mtm_p5_x_${tag}_${h.slice(0, 15)}`, // wrong random length
      `MTM_P5_X_${tag}_${h}`,
    ])
      expect(isOwnedSchema(name, tag)).toBe(false);
    expect(isOwnedSchema(`mtm_p5_x_${tag}_${h}`, "r.*")).toBe(false);
  });
});

const url = process.env.MTM_ADMIN_TEST_DATABASE_URL;
describe.skipIf(!url)(
  "run-scoped schema cleanup (loopback test cluster)",
  () => {
    // A synthetic tag, never the guarded runner's own, so this test cannot
    // touch the live regression schema of the run executing it.
    const mine = runTag(randomUUID());
    const theirs = runTag(randomUUID());
    const fixtures: string[] = [];
    let db: Client;
    const create = async (name: string, withData = false) => {
      // PostgreSQL truncates identifiers over 63 bytes; fixtures must fit.
      expect(Buffer.byteLength(name)).toBeLessThanOrEqual(63);
      fixtures.push(name);
      const q = db.escapeIdentifier(name);
      await db.query(`CREATE SCHEMA ${q}`);
      if (withData) {
        await db.query(`CREATE TABLE ${q}.t (id int)`);
        await db.query(`INSERT INTO ${q}.t VALUES (1),(2),(3)`);
      }
      return name;
    };
    const exists = async (name: string) =>
      (await listSchemas(db)).includes(name);
    afterAll(async () => {
      // This file's own fixtures, dropped by exact recorded name, quoted.
      for (const name of fixtures)
        await db.query(
          `DROP SCHEMA IF EXISTS ${db.escapeIdentifier(name)} CASCADE`,
        );
      await db.end();
    });

    it("drops only this run's schemas and reports everything else", async () => {
      const target = new URL(url!);
      if (target.hostname !== "127.0.0.1" && target.hostname !== "localhost")
        throw new Error("Unsafe database target");
      db = new Client({ connectionString: url });
      await db.connect();
      const before = new Set(await listSchemas(db));
      const retainedTables = (
        await db.query(
          "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'",
        )
      ).rows[0].n;

      // (a) this run's schemas, one simulating a test that failed before its
      // own afterAll could run (tables and rows left behind).
      const ownEmpty = await create(testSchemaName("mtm_p5_own_", mine));
      const ownFailed = await create(
        testSchemaName("mtm_p5_failed_", mine),
        true,
      );
      // (b) a concurrent run's schema, with data.
      const other = await create(testSchemaName("mtm_p5_other_", theirs), true);
      // (c) an unrelated leftover.
      const leftover = await create(`mtm_manual_leftover_${hex16()}`, true);
      // (d) unusual but valid identifiers crafted to look like ours / inject SQL.
      const injected = await create(
        `mtm_x_${mine}_${hex16()}";DROP SCHEMA public;--`,
      );
      const lookalike = await create(`mtm_p5_x_${mine}_${hex16()}_extra`);
      const quoted = await create(`Evil "Schema"; DROP SCHEMA public; --`);

      const result = await cleanupRunSchemas(db, mine, before);

      expect(result.dropped.sort()).toEqual([ownEmpty, ownFailed].sort());
      expect(await exists(ownEmpty)).toBe(false);
      expect(await exists(ownFailed)).toBe(false); // (e) failed-test cleanup
      for (const kept of [other, leftover, injected, lookalike, quoted]) {
        expect(await exists(kept)).toBe(true);
        expect(result.foreign).toContain(kept);
      }
      // Other runs' data is intact, and public was never touched.
      expect(
        (
          await db.query(
            `SELECT count(*)::int AS n FROM ${db.escapeIdentifier(other)}.t`,
          )
        ).rows[0].n,
      ).toBe(3);
      expect(await exists("public")).toBe(true);
      expect(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'",
          )
        ).rows[0].n,
      ).toBe(retainedTables);
      // Pre-existing schemas are neither dropped nor reported.
      for (const name of before) {
        expect(await exists(name)).toBe(true);
        expect(result.foreign).not.toContain(name);
      }
    });

    it("a concurrent run's cleanup leaves this run's schemas alone", async () => {
      const before = new Set(await listSchemas(db));
      const mineLive = await create(testSchemaName("mtm_p5_live_", mine), true);
      const result = await cleanupRunSchemas(db, theirs, before);
      expect(result.dropped).not.toContain(mineLive);
      expect(await exists(mineLive)).toBe(true);
      // Its own schema from the previous test is removed by its own cleanup.
      expect(result.dropped.every((s) => isOwnedSchema(s, theirs))).toBe(true);
    });
  },
);
