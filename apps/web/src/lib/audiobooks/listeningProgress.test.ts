import { describe, expect, it } from "vitest";
import {
  inProgressStoryIds,
  libraryStoryIds,
  parseProgress,
  progressFraction,
  resumePosition,
  type ListeningProgressState,
} from "./listeningProgress";
import { formatClock, formatMinutes, formatRemaining } from "./formatTime";

const state: ListeningProgressState = {
  stories: {
    old: {
      positionSeconds: 30,
      durationSeconds: 600,
      completed: false,
      updatedAt: 1,
    },
    recent: {
      positionSeconds: 90,
      durationSeconds: 600,
      completed: false,
      updatedAt: 3,
    },
    done: {
      positionSeconds: 600,
      durationSeconds: 600,
      completed: true,
      updatedAt: 2,
    },
    untouched: {
      positionSeconds: 0,
      durationSeconds: 600,
      completed: false,
      updatedAt: 4,
    },
  },
};

describe("parseProgress", () => {
  it("returns empty state for missing or corrupt storage", () => {
    expect(parseProgress(null).stories).toEqual({});
    expect(parseProgress("not json").stories).toEqual({});
    expect(parseProgress('{"stories":null}').stories).toEqual({});
  });

  it("keeps valid entries and drops malformed ones", () => {
    const parsed = parseProgress(
      JSON.stringify({
        stories: {
          ok: {
            positionSeconds: 12,
            durationSeconds: 100,
            completed: false,
            updatedAt: 5,
          },
          bad: { positionSeconds: "12" },
        },
      }),
    );
    expect(Object.keys(parsed.stories)).toEqual(["ok"]);
  });
});

describe("progress selectors", () => {
  it("lists unfinished started stories, most recent first", () => {
    expect(inProgressStoryIds(state)).toEqual(["recent", "old"]);
  });

  it("lists every started or finished story in the library", () => {
    expect(libraryStoryIds(state)).toEqual(["recent", "done", "old"]);
  });

  it("computes fractions and resume positions", () => {
    expect(progressFraction(state.stories.recent)).toBeCloseTo(0.15);
    expect(progressFraction(state.stories.done)).toBe(1);
    expect(progressFraction(undefined)).toBe(0);
    expect(resumePosition(state.stories.recent)).toBe(90);
    expect(resumePosition(state.stories.done)).toBe(0);
  });
});

describe("formatTime", () => {
  it("formats clocks, minutes and remaining time", () => {
    expect(formatClock(332)).toBe("05:32");
    expect(formatClock(3729)).toBe("1:02:09");
    expect(formatClock(Number.NaN)).toBe("00:00");
    expect(formatMinutes(18 * 60 + 20)).toBe("18 min");
    expect(formatRemaining(332)).toBe("5m 32s left");
  });
});
