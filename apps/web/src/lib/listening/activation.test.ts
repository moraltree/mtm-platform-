import { afterEach, describe, expect, it, vi } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PoolClient } from "pg";
import { listeningTelemetryEnabled, recordListeningEvents } from "./events";

const SRC = fileURLToPath(new URL("../../", import.meta.url));
async function sources(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await sources(path)));
    else if (
      /\.(ts|tsx|mjs)$/.test(entry.name) &&
      !/\.test\.ts$/.test(entry.name)
    )
      out.push(path);
  }
  return out;
}

describe("listening telemetry stays OFF (Phase 5)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is off unless LISTENING_TELEMETRY_ENABLED is exactly true", () => {
    expect(listeningTelemetryEnabled()).toBe(false);
    for (const v of ["1", "TRUE", "yes", " true"]) {
      vi.stubEnv("LISTENING_TELEMETRY_ENABLED", v);
      expect(listeningTelemetryEnabled()).toBe(false);
    }
  });

  it("the recorder writes nothing while disabled", async () => {
    const query = vi.fn();
    await expect(
      recordListeningEvents(
        { query } as unknown as PoolClient,
        { id: null, listenerClass: "anonymous" },
        [],
      ),
    ).rejects.toThrow(/not enabled/);
    expect(query).not.toHaveBeenCalled();
  });

  it("no application module imports the recorder and no ingestion route exists", async () => {
    const files = await sources(SRC);
    const importers = [];
    for (const f of files)
      if (/listening\/events/.test(await readFile(f, "utf8")))
        importers.push(f.slice(SRC.length));
    expect(importers).toEqual([]);
    expect(files.some((f) => /app\/api\/.*listen/i.test(f))).toBe(false);
  });
});
