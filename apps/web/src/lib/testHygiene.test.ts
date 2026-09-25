/**
 * Phase 5: tests must not leave servers or processes behind (22 orphaned
 * dev servers were found on the host). Static guard over test code and
 * scripts: anything that listens must bind loopback, and child processes
 * must be synchronous or explicitly managed.
 */
import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = fileURLToPath(new URL("../../", import.meta.url));
async function files(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (["node_modules", ".next"].includes(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await files(p)));
    else if (/\.(ts|tsx|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

describe("test process hygiene", () => {
  it("binds any listening server to loopback and never starts next dev/start unbound", async () => {
    const offenders: string[] = [];
    const all = [
      ...(await files(join(WEB, "src"))),
      ...(await files(join(WEB, "scripts"))),
    ].filter((f) => /\.test\.ts$|scripts\//.test(f));
    for (const f of all) {
      const text = await readFile(f, "utf8");
      const rel = relative(WEB, f);
      for (const [i, line] of text.split("\n").entries()) {
        if (/\.listen\(/.test(line) && !/127\.0\.0\.1|localhost|::1/.test(line))
          offenders.push(`${rel}:${i + 1} listen without loopback host`);
        if (
          /["'`]next["'`]\s*,\s*\[\s*["'`](dev|start)/.test(line) &&
          !/-H|--hostname/.test(line)
        )
          offenders.push(`${rel}:${i + 1} next server without -H 127.0.0.1`);
        // Background children must be managed (detached group + cleanup).
        if (/\bspawn\(/.test(line) && !/spawnSync|detached/.test(text))
          offenders.push(`${rel}:${i + 1} unmanaged spawn`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the guarded runner stops orphans and drops only its own schemas", async () => {
    const runner = await readFile(
      join(WEB, "scripts/test-admin-analytics.mjs"),
      "utf8",
    );
    expect(runner).toMatch(/detached: true/);
    expect(runner).toMatch(/MTM_TEST_RUN_ID/);
    expect(runner).toMatch(/process\.kill\(-child\.pid/);
    // Schema removal goes only through the run-scoped, quoted cleanup
    // (behaviour proven in src/lib/database/testSchemas.test.ts).
    expect(runner).toMatch(/cleanupRunSchemas\(db, tag, schemasBefore\)/);
    expect(runner).not.toMatch(/DROP SCHEMA/);
  });

  it("every test that creates a schema names it with the run tag", async () => {
    const offenders: string[] = [];
    for (const f of await files(join(WEB, "src")))
      if (/\.test\.ts$/.test(f) && !f.endsWith("testHygiene.test.ts")) {
        const text = await readFile(f, "utf8");
        if (/CREATE SCHEMA/.test(text) && !/testSchemaName\(/.test(text))
          offenders.push(relative(WEB, f));
      }
    expect(offenders).toEqual([]);
  });
});
