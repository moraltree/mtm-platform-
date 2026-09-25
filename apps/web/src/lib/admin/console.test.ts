import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  query: vi.fn(),
  overview: vi.fn(),
  loaders: {
    coverageStarts: vi.fn(),
    loadSubscribers: vi.fn(),
    loadRevenue: vi.fn(),
    loadCohorts: vi.fn(),
    loadCampaigns: vi.fn(),
    loadAudience: vi.fn(),
    loadListening: vi.fn(),
    loadCoverage: vi.fn(),
  },
  auth: vi.fn(),
}));
vi.mock("./overview", () => ({
  withSnapshot: (work: (db: unknown) => unknown) => work({ query: m.query }),
  readOverviewIn: m.overview,
}));
vi.mock("./intel/load", () => m.loaders);
vi.mock("./auth", () => ({ authorizeAdmin: m.auth }));
import { getConsole, readConsole, VIEW_SECTIONS } from "./console";
import { VIEWS } from "@/app/admin/views";

describe("view-scoped console loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.query.mockResolvedValue({ rows: [{ present: true }] });
    m.loaders.coverageStarts.mockResolvedValue(new Map());
    for (const [name, fn] of Object.entries(m.loaders))
      if (name !== "coverageStarts") fn.mockResolvedValue({ from: name });
    m.overview.mockResolvedValue({ asOf: "x" });
  });
  it("every view declares its sections", () => {
    expect(Object.keys(VIEW_SECTIONS).sort()).toEqual(
      VIEWS.map((v) => v.id).sort(),
    );
  });
  it.each([
    ["cohorts", ["loadCohorts"], false],
    ["campaigns", ["loadCampaigns", "loadListening"], false],
    ["audience", ["loadAudience"], false],
    ["listening", ["loadListening"], false],
    ["coverage", ["loadCoverage", "loadListening"], false],
    ["growth", ["loadSubscribers"], true],
    ["finance", ["loadRevenue"], true],
    ["overview", ["loadCoverage"], true],
    ["activity", [], true],
  ] as const)(
    "%s runs only its own loaders",
    async (view, expected, overview) => {
      await readConsole(view, "7d", { now: new Date("2026-09-11T12:00:00Z") });
      const called = Object.entries(m.loaders)
        .filter(
          ([name, fn]) => name !== "coverageStarts" && fn.mock.calls.length,
        )
        .map(([name]) => name)
        .sort();
      expect(called).toEqual([...expected].sort());
      expect(m.overview).toHaveBeenCalledTimes(overview ? 1 : 0);
    },
  );
  it("reports the Phase 4 migration as absent instead of running its queries", async () => {
    m.query.mockResolvedValue({ rows: [{ present: false }] });
    const data = await readConsole("campaigns", "7d");
    expect(data).toEqual({ overview: null, intelInstalled: false });
    expect(m.loaders.loadCampaigns).not.toHaveBeenCalled();
  });
  it("authorizes before reading and hides failures", async () => {
    m.auth.mockResolvedValue(null);
    expect(await getConsole("finance", "7d")).toEqual({ status: "denied" });
    expect(m.query).not.toHaveBeenCalled();
    m.auth.mockResolvedValue({ role: "admin" });
    m.query.mockRejectedValue(new Error("SENTINEL"));
    expect(await getConsole("finance", "7d")).toEqual({
      status: "unavailable",
    });
  });
});
