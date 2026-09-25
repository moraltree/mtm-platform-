import { describe, expect, it } from "vitest";
import {
  compare,
  dayCoverage,
  fillDays,
  niceMax,
  seriesStart,
  share,
  UP_IS_GOOD,
  SERIES,
} from "./insights";
import { parseView, VIEWS } from "@/app/admin/views";

describe("Phase 3 insight rules", () => {
  const now = new Date("2026-03-01T09:30:00Z");
  it("zero-fills exactly 30 consecutive UTC days ending today, across month ends", () => {
    const points = fillDays(new Map([["2026-02-28", 4]]), now);
    expect(points).toHaveLength(30);
    expect(points[0].day).toBe("2026-01-31");
    expect(points.at(-1)).toEqual({
      day: "2026-03-01",
      value: 0,
      partial: true,
    });
    expect(points.at(-2)).toEqual({
      day: "2026-02-28",
      value: 4,
      partial: false,
    });
    expect(points.filter((p) => p.partial)).toHaveLength(1);
    expect(seriesStart(now)).toEqual(new Date("2026-01-31T00:00:00Z"));
  });
  it("uses UTC even just before midnight", () => {
    const late = new Date("2026-12-31T23:59:59.999Z");
    expect(fillDays(new Map(), late).at(-1)?.day).toBe("2026-12-31");
    expect(seriesStart(late)).toEqual(new Date("2026-12-02T00:00:00Z"));
  });
  it("compares equal windows without inventing a percentage from zero", () => {
    expect(compare(6, 4)).toEqual({
      current: 6,
      previous: 4,
      change: 50,
      direction: "up",
    });
    expect(compare(1, 3)).toMatchObject({ change: -66.7, direction: "down" });
    expect(compare(3, 0)).toMatchObject({ change: null, direction: "up" });
    expect(compare(0, 0)).toMatchObject({ change: null, direction: "flat" });
  });
  it("classifies each day against a coverage start instant", () => {
    const start = new Date("2026-09-05T10:00:00Z");
    expect(dayCoverage("2026-09-04", start)).toBe("none");
    expect(dayCoverage("2026-09-05", start)).toBe("partial");
    expect(dayCoverage("2026-09-06", start)).toBe("full");
    expect(dayCoverage("2026-09-05", new Date("2026-09-05T00:00:00Z"))).toBe(
      "full",
    );
  });
  it("computes shares and clean axis maxima", () => {
    expect(share(1, 3)).toBe(33.3);
    expect(share(1, 0)).toBeNull();
    expect([0, 1, 3, 7, 12, 99, 101, 2500].map(niceMax)).toEqual([
      1, 1, 5, 10, 20, 100, 200, 5000,
    ]);
  });
  it("marks cancellations and failed payments as bad news when rising", () => {
    expect(SERIES.filter((k) => !UP_IS_GOOD[k])).toEqual([
      "cancellations",
      "failed_payments",
    ]);
  });
  it("allowlists console views", () => {
    expect(parseView("finance")).toBe("finance");
    expect(parseView(["growth", "finance"])).toBe("growth");
    for (const bad of [
      undefined,
      "",
      "FINANCE",
      "../admin",
      "<script>",
      "overview ",
      ["nope"],
      42,
    ])
      expect(parseView(bad)).toBe("overview");
    expect(parseView("roadmap")).toBe("coverage"); // Phase 3 bookmark.
    for (const proto of [
      "__proto__",
      "constructor",
      "toString",
      "hasOwnProperty",
    ])
      expect(parseView(proto)).toBe("overview");
    expect(VIEWS.map((v) => v.id)).toEqual([
      "overview",
      "growth",
      "cohorts",
      "finance",
      "funnel",
      "campaigns",
      "audience",
      "listening",
      "operations",
      "activity",
      "coverage",
    ]);
  });
});
