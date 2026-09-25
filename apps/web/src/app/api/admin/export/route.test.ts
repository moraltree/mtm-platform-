import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({ authorizeAdminActor: mocks.auth }));
vi.mock("@/lib/admin/console", () => ({ readConsole: mocks.read }));
import { GET } from "./route";

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
        title: "Listening & content",
        status: "unavailable",
        since: null,
        source: "Schema ready",
        detail: "=cmd|' /C calc'!A0",
      },
    ],
  },
};

describe("aggregate CSV export boundary", () => {
  let info: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.clearAllMocks();
    info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    mocks.auth.mockResolvedValue({
      role: "founder",
      actor: "a1b2c3d4e5f6a7b8",
    });
    mocks.read.mockResolvedValue(coverage);
  });
  afterEach(() => info.mockRestore());
  it("denies without a server-side grant and never reads data", async () => {
    mocks.auth.mockResolvedValue(null);
    const r = await get("report=coverage");
    expect(r.status).toBe(403);
    expect(r.headers.get("cache-control")).toContain("no-store");
    expect(mocks.read).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
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
  it("returns an audited, no-store aggregate CSV with neutralised formulas", async () => {
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
    const audit = JSON.parse(info.mock.calls[0][0] as string);
    expect(audit).toMatchObject({
      event: "admin_export",
      actor: "a1b2c3d4e5f6a7b8",
      role: "founder",
      report: "coverage",
      period: "30d",
    });
  });
  it("maps each report to its view and period", async () => {
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
    }
    expect(info).not.toHaveBeenCalled();
  });
  it("returns 503 without detail when the snapshot fails", async () => {
    mocks.read.mockRejectedValue(new Error("SENTINEL_PRIVATE"));
    const r = await get("report=revenue");
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain("SENTINEL");
  });
});
