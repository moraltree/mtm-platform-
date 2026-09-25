import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { errorSummary, redactSecrets } from "./safeLog";
import { scan } from "../../scripts/lib/secretScan.mjs";

// Canary values are assembled at runtime so no credential-shaped literal
// exists in this file (the repository scan would otherwise flag it).
const CANARY = "CANARYLEAK" + "7f3a9c";
const live = ["sk", "live", CANARY.padEnd(30, "Z")].join("_");
const hook = ["whsec", CANARY.padEnd(30, "Q")].join("_");
const resend = ["re", "ab12cd34", CANARY.padEnd(20, "R")].join("_");
const dbUrl = `postgresql://mtm_app:${CANARY}pw@db.${CANARY.toLowerCase()}.net:5432/mtm`;
const WEB = fileURLToPath(new URL("../../", import.meta.url));

const captured: string[] = [];
beforeEach(() => {
  captured.length = 0;
  for (const level of ["log", "info", "warn", "error", "debug"] as const)
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      captured.push(
        args
          .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
          .join(" "),
      );
    });
});
afterEach(() => vi.restoreAllMocks());
const noCanary = (text: string) => {
  expect(text).not.toContain(CANARY);
  expect(text.toLowerCase()).not.toContain(CANARY.toLowerCase());
};

describe("log-safe errors", () => {
  it("reduces provider errors to classification fields only", () => {
    // Shaped like Stripe's signature error: carries payload and header.
    const error = Object.assign(new Error(`bad signature ${hook}`), {
      type: "StripeSignatureVerificationError",
      header: `t=1,v1=${CANARY}`,
      payload: JSON.stringify({
        email: "parent@example.invalid",
        secret: live,
      }),
      statusCode: 400,
      raw: { headers: { authorization: `Bearer ${CANARY}` } },
    });
    const summary = errorSummary(error);
    expect(summary).toEqual({
      name: "Error",
      type: "StripeSignatureVerificationError",
      status: "400",
    });
    noCanary(JSON.stringify(summary));
  });
  it("redacts every credential shape", () => {
    const text = [live, hook, resend, dbUrl, `Bearer ${CANARY}abcdef`].join(
      " ",
    );
    const redacted = redactSecrets(text);
    noCanary(redacted);
    expect(redacted.match(/\[redacted\]/g)?.length).toBe(5);
  });
});

describe("no secret reaches responses, errors or logs", () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it("database configuration errors never echo the URL", async () => {
    process.env.SUBSCRIPTIONS_ENABLED = "true";
    process.env.SUBSCRIPTIONS_DATABASE_URL = dbUrl; // remote without verify-full
    vi.resetModules();
    const { database } = await import("./subscriptions/db");
    let message = "";
    try {
      database();
    } catch (e) {
      message = String(e) + JSON.stringify(e);
    }
    expect(message).toMatch(/verify-full/);
    noCanary(message);
    noCanary(captured.join("\n"));
  });

  it("the subscription webhook refuses misconfiguration without echoing values", async () => {
    Object.assign(process.env, {
      SUBSCRIPTIONS_ENABLED: "true",
      STRIPE_SECRET_KEY: live,
      STRIPE_WEBHOOK_SECRET: hook,
      RESEND_API_KEY: resend,
      SUBSCRIPTIONS_DATABASE_URL: dbUrl,
      STRIPE_MONTHLY_PRICE_ID: `price_${CANARY}`,
    });
    vi.resetModules();
    const { POST } = await import("@/app/api/subscriptions/webhook/route");
    const r = await POST(
      new Request("http://localhost/api/subscriptions/webhook", {
        method: "POST",
        body: JSON.stringify({ secret: CANARY }),
        headers: { "stripe-signature": `t=1,v1=${CANARY}` },
      }),
    );
    expect(r.status).toBe(503);
    noCanary(await r.text());
    noCanary(JSON.stringify(Object.fromEntries(r.headers)));
    noCanary(captured.join("\n"));
  });

  it.each([
    ["check-subscriptions.mjs", []],
    ["migrate.mjs", ["status"]],
  ])("operator script %s prints no configured value", (script, args) => {
    const result = spawnSync(
      process.execPath,
      [join(WEB, "scripts", script), ...args],
      {
        cwd: WEB,
        encoding: "utf8",
        timeout: 20_000,
        env: {
          PATH: process.env.PATH,
          NODE_ENV: "test", // Next does not load .env.local in test mode.
          STRIPE_SECRET_KEY: live, // Live-shaped: refused before any request.
          STRIPE_WEBHOOK_SECRET: hook,
          STRIPE_ACCOUNT_ID: `acct_${CANARY}`,
          STRIPE_PRICE_MONTHLY: `price_${CANARY}`,
          STRIPE_MONTHLY_PRICE_ID: `price_${CANARY}`,
          RESEND_API_KEY: resend,
          SUBSCRIPTIONS_DATABASE_URL: dbUrl,
          MTM_MIGRATION_DATABASE_URL: dbUrl,
          LIBRARY_AUDIO_TOKEN: CANARY,
        },
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1); // Refused, fail closed.
    noCanary(result.stdout + result.stderr);
  });
});

describe("repository secret scan", () => {
  it("finds credential shapes and reports locations only", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mtm-scan-"));
    try {
      // Unmarked synthetic credentials (marked fixture lines are skipped).
      const key = ["sk", "live", "Q9w8".repeat(8)].join("_");
      const mail = ["re", "Ab12Cd34", "Zx9Yw8Vu7Ts6"].join("_");
      await writeFile(
        join(dir, "leak.ts"),
        `const a = "${key}";\nconst ok = 1;\nconst b = "${mail}";\n`,
      );
      const findings = await scan(dir, ["leak.ts"]);
      expect(findings).toEqual([
        { file: "leak.ts", line: 1, pattern: "stripe-secret-key" },
        { file: "leak.ts", line: 3, pattern: "resend-api-key" },
      ]);
      expect(JSON.stringify(findings)).not.toContain("Q9w8");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("the working tree (tracked and new files) contains no credentials", async () => {
    const root = fileURLToPath(new URL("../../../../", import.meta.url));
    const { repoFiles, envFiles } =
      await import("../../scripts/lib/secretScan.mjs");
    const files = repoFiles(root);
    expect(files.length).toBeGreaterThan(100);
    expect(envFiles(files)).toEqual([]);
    expect(await scan(root, files)).toEqual([]);
  });
});
