import { describe, expect, it } from "vitest";
import { validateListeningEvent } from "./events";

const now = new Date("2026-09-25T12:00:00Z");
const event = (extra: Record<string, unknown> = {}) => ({
  sessionId: "0f8fad5b-d9cb-469f-a165-70867728950e",
  seq: 3,
  type: "progress",
  storyId: "story-12",
  occurredAt: "2026-09-25T11:59:00Z",
  positionSeconds: 120,
  listenedSeconds: 30,
  storyDurationSeconds: 900,
  device: "tablet",
  ...extra,
});

describe("listening telemetry contract (schema only, not wired)", () => {
  it("accepts a minimal, well-formed event", () => {
    expect(validateListeningEvent(event(), now)).toEqual({
      ok: true,
      event: event(),
    });
  });
  it.each([
    [{ email: "parent@example.test" }, "unexpected field email"],
    [{ ip: "203.0.113.9" }, "unexpected field ip"],
    [{ userAgent: "x" }, "unexpected field userAgent"],
    [{ listenerClass: "paid" }, "unexpected field listenerClass"],
    [{ latitude: 51.5 }, "unexpected field latitude"],
    [{ sessionId: "device-fingerprint" }, "invalid session"],
    [{ seq: -1 }, "invalid sequence"],
    [{ seq: 1.5 }, "invalid sequence"],
    [{ type: "purchase" }, "invalid type"],
    [{ storyId: "../etc/passwd" }, "invalid story"],
    [{ occurredAt: "yesterday" }, "invalid time"],
    [{ occurredAt: "2026-09-25T12:06:00Z" }, "time in the future"],
    [{ occurredAt: "2026-09-17T12:00:00Z" }, "time too old"],
    [{ listenedSeconds: 3601 }, "invalid listened seconds"],
    [{ positionSeconds: -5 }, "invalid position"],
    [{ storyDurationSeconds: 0 }, "invalid duration"],
    [{ device: "iPhone 15 Pro, serial 123" }, "invalid device class"],
  ])("rejects %o", (extra, reason) => {
    expect(validateListeningEvent(event(extra), now)).toEqual({
      ok: false,
      reason,
    });
  });
  it("rejects non-objects", () => {
    for (const bad of [null, "x", [], 3])
      expect(validateListeningEvent(bad, now).ok).toBe(false);
  });
});
