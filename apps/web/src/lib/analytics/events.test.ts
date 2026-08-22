import { describe, expect, it, vi } from "vitest";
import { consoleConversionEventSink, type ConversionEvent } from "./events";
import { asCampaignId } from "../platform/ids";

describe("consoleConversionEventSink", () => {
  it("logs every event type without throwing and without a real destination", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const campaignId = asCampaignId("test-campaign");

    const events: ConversionEvent[] = [
      { type: "campaign_landing_viewed", campaignId },
      { type: "cta_clicked", campaignId },
      { type: "registration_started", campaignId },
      { type: "registration_completed", campaignId },
      { type: "trial_activated", campaignId },
      { type: "subscription_handoff_started", campaignId },
      {
        type: "subscription_outcome_placeholder",
        campaignId,
        outcome: "succeeded",
      },
      { type: "reward_eligibility", campaignId, state: "pending" },
    ];

    for (const event of events) {
      expect(() => consoleConversionEventSink.track(event)).not.toThrow();
    }
    expect(spy).toHaveBeenCalledTimes(events.length);
    spy.mockRestore();
  });

  it("never receives a name/email field on any event (type-level, smoke-checked at runtime)", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const campaignId = asCampaignId("test-campaign");
    consoleConversionEventSink.track({
      type: "registration_completed",
      campaignId,
    });
    const loggedPayload = spy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(loggedPayload).not.toHaveProperty("email");
    expect(loggedPayload).not.toHaveProperty("firstName");
    expect(loggedPayload).not.toHaveProperty("lastName");
    spy.mockRestore();
  });
});
