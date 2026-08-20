import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Phase 3 — the campaign platform's tenant/Story-World isolation and
 * theme-resolution logic previously had only a one-off verification
 * script (see the Phase 2 report). This is a real, committed test
 * suite instead. Scoped to `lib/**` — pure query/theme/attribution
 * logic with no Next.js runtime dependency (no `next/*` imports), so
 * plain Node is enough; no jsdom, no Next test harness needed.
 *
 * `USE_MOCK_CONTENT=true` here matches how every route in this app is
 * actually verified without a real Sanity project (see CLAUDE.md) —
 * tests exercise the same mock-fallback path production traffic would
 * hit today, not a third, test-only content source.
 *
 * `fileParallelism: false` (Phase 4) — found by hand when adding a
 * fourth/fifth test file made previously-passing tests start failing
 * with "not found" for real fixtures: `test.env`'s `USE_MOCK_CONTENT`
 * injection is not reliably visible to `lib/sanity/env.ts`'s
 * module-load-time `useMockContent` constant in every worker under this
 * project's default multi-worker pool, so a worker whose first import
 * happened before the injection landed would permanently read `false`
 * for its lifetime. This suite is small enough (currently well under a
 * second) that running test files sequentially in one worker costs
 * nothing worth trading correctness for.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      USE_MOCK_CONTENT: "true",
    },
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
