import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  read: vi.fn(),
  audit: vi.fn(),
  limited: vi.fn(),
}));
vi.mock("@/lib/admin/auth", () => ({ authorizeAdminActor: mocks.auth }));
vi.mock("@/lib/admin/console", () => ({ readConsole: mocks.read }));
vi.mock("@/lib/admin/exportAudit", () => ({
  recordExportAudit: mocks.audit,
  exportRateLimited: mocks.limited,
}));
// Adds a hypothetical sensitive report so the step-up boundary is exercised.
vi.mock("@/lib/admin/intel/exports", async (actual) => {
  const real = await actual<typeof import("@/lib/admin/intel/exports")>();
  const EXPORT_REPORTS = {
    ...real.EXPORT_REPORTS,
    people: { view: "growth", sensitivity: "sensitive" },
  };
  return {
    ...real,
    EXPORT_REPORTS,
    parseReport: (v: unknown) =>
      v === "people" ? "people" : real.parseReport(v),
  };
});
import { GET } from "./route";

const ACCOUNT = "3f0c8a3e-2d7b-4b6a-9d59-0c6b1a2e4f10";
const get = (qs: string) =>
  GET(new Request(`http://localhost/api/admin/export?${qs}`));
const coverage = {
  overview: null,
  intelInstalled: true,
  coverage: {
    sandbox: true,
    domains: [
      {
        id: "listening",
        title: "=cmd|' /C calc'!A0",
        status: "unavailable",
        since: null,
        source: "Schema ready",
        detail: "3 accounts recorded",
      },
    ],
  },
};
const enable = () => {
  process.env.SUBSCRIPTIONS_ENABLED = "true";
  process.env.ADMIN_ANALYTICS_ENABLED = "true";
  process.env.ADMIN_EXPORTS_ENABLED = "true";
};

describe("aggregate CSV export boundary", () => {
  let info: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.clearAllMocks();
    enable();
    info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    mocks.auth.mockResolvedValue({
      role: "founder",
      actor: "a1b2c3d4e5f6a7b8",
      accountId: ACCOUNT,
    });
    mocks.read.mockResolvedValue(coverage);
    mocks.audit.mockResolvedValue(undefined);
    mocks.limited.mockResolvedValue(false);
  });
  afterEach(() => {
    info.mockRestore();
    delete process.env.ADMIN_EXPORTS_ENABLED;
    delete process.env.ADMIN_ANALYTICS_ENABLED;
    delete process.env.SUBSCRIPTIONS_ENABLED;
  });

  it.each([
    ["exports flag unset", "ADMIN_EXPORTS_ENABLED"],
    ["console disabled", "ADMIN_ANALYTICS_ENABLED"],
    ["subscriptions disabled", "SUBSCRIPTIONS_ENABLED"],
  ])("is a 404 with %s and touches nothing", async (_, flag) => {
    delete process.env[flag];
    const r = await get("report=coverage");
    expect(r.status).toBe(404);
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("treats any value other than the string true as off", async () => {
    process.env.ADMIN_EXPORTS_ENABLED = "TRUE";
    expect((await get("report=coverage")).status).toBe(404);
  });
  it("denies without a server-side grant and never reads data", async () => {
    mocks.auth.mockResolvedValue(null);
    const r = await get("report=coverage");
    expect(r.status).toBe(403);
    expect(r.headers.get("cache-control")).toContain("no-store");
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("fails closed without leaking session errors", async () => {
    mocks.auth.mockRejectedValue(new Error("SENTINEL_DB_URL"));
    const r = await get("report=coverage");
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain("SENTINEL");
  });
  it.each(["", "report=emails", "report=__proto__", "report=accounts"])(
    "rejects unknown report %s",
    async (qs) => {
      expect((await get(qs)).status).toBe(400);
      expect(mocks.read).not.toHaveBeenCalled();
    },
  );
  it("refuses sensitive reports without step-up and audits the refusal", async () => {
    const r = await get("report=people&period=30d");
    expect(r.status).toBe(403);
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        report: "people",
        sensitivity: "sensitive",
        outcome: "step_up_required",
      }),
    );
  });
  it("releases an audited, no-store aggregate CSV with neutralised formulas", async () => {
    const r = await get("report=coverage&period=../../etc");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(r.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(r.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(r.headers.get("referrer-policy")).toBe("no-referrer");
    expect(r.headers.get("content-disposition")).toMatch(
      /^attachment; filename="mtm-coverage-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    expect(mocks.read).toHaveBeenCalledWith(
      "coverage",
      "30d",
      expect.any(Object),
    );
    const body = await r.text();
    expect(body).toContain(`"'=cmd|' /C calc'!A0"`);
    expect(body).toContain("no personal data");
    expect(body).not.toContain("3 accounts recorded"); // detail omitted
    expect(mocks.audit).toHaveBeenCalledTimes(1);
    const audit = mocks.audit.mock.calls[0][0];
    expect(audit).toEqual({
      requestId: r.headers.get("x-request-id"),
      accountId: ACCOUNT,
      role: "founder",
      report: "coverage",
      sensitivity: "aggregate",
      filters: { period: "30d" },
      outcome: "released",
      rowCount: 1,
      byteCount: Buffer.byteLength(body),
      contentSha256: createHash("sha256").update(body).digest("hex"),
    });
    // Audit metadata only: nothing from the exported content.
    expect(JSON.stringify(audit)).not.toContain("calc");
    expect(info).not.toHaveBeenCalled();
  });
  it("releases nothing when the audit row cannot be written", async () => {
    mocks.audit.mockRejectedValue(new Error("SENTINEL_AUDIT"));
    const r = await get("report=coverage");
    expect(r.status).toBe(503);
    const body = await r.text();
    expect(body).not.toContain("Schema ready");
    expect(body).not.toContain("SENTINEL");
  });
  it("rate limits per actor and audits the refusal", async () => {
    mocks.limited.mockResolvedValue(true);
    const r = await get("report=coverage");
    expect(r.status).toBe(429);
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "rate_limited" }),
    );
  });
  it("maps each report to its view and audits unavailable data", async () => {
    mocks.read.mockResolvedValue({ overview: null, intelInstalled: false });
    for (const [report, view] of [
      ["subscribers", "growth"],
      ["revenue", "finance"],
      ["cohorts", "cohorts"],
      ["campaigns", "campaigns"],
    ]) {
      const r = await get(`report=${report}&period=90d`);
      expect(r.status).toBe(409); // No data: never an empty "zero" file.
      expect(mocks.read).toHaveBeenLastCalledWith(
        view,
        "90d",
        expect.any(Object),
      );
      expect(mocks.audit).toHaveBeenLastCalledWith(
        expect.objectContaining({ report, outcome: "unavailable" }),
      );
    }
  });
  it("returns 503 without detail when the snapshot fails", async () => {
    mocks.read.mockRejectedValue(new Error("SENTINEL_PRIVATE"));
    const r = await get("report=revenue");
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain("SENTINEL");
  });
});
