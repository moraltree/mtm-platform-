import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Client, Pool } from "pg";
import { databaseConfig } from "./policy.mjs";

const url = process.env.MTM_ADMIN_TEST_DATABASE_URL;
describe.skipIf(!url)(
  "serverless pool behaviour (loopback test cluster)",
  () => {
    it("never opens more connections than the configured bound and leaves none behind", async () => {
      const target = new URL(url!);
      if (target.hostname !== "127.0.0.1" && target.hostname !== "localhost")
        throw new Error("Unsafe database target");
      const name = "mtm_p5_pool_" + randomUUID().slice(0, 8);
      target.searchParams.set("application_name", name);
      const config = databaseConfig(target.toString(), {
        env: { SUBSCRIPTIONS_DATABASE_POOL_MAX: "2" },
      });
      expect(config.application_name).toBe(name);
      const pool = new Pool(config);
      const observer = new Client({ connectionString: url });
      await observer.connect();
      const open = async () =>
        (
          await observer.query(
            "SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name=$1",
            [name],
          )
        ).rows[0].n;
      try {
        let peak = 0;
        const burst = Promise.all(
          Array.from({ length: 20 }, () => pool.query("SELECT pg_sleep(0.02)")),
        );
        const sampler = (async () => {
          for (let i = 0; i < 10; i++) {
            peak = Math.max(peak, await open());
            await new Promise((r) => setTimeout(r, 15));
          }
        })();
        await Promise.all([burst, sampler]);
        expect(peak).toBeGreaterThan(0);
        expect(peak).toBeLessThanOrEqual(2);
      } finally {
        await pool.end();
      }
      expect(await open()).toBe(0);
      await observer.end();
    });
  },
);
