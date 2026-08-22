import type {
  AcquisitionSourceCode,
  CampaignId,
  PartnerId,
  StoryWorldId,
} from "../platform/ids";
import type { RewardType } from "../rewards/types";

/**
 * Typed conversion-event boundary for the campaign→registration journey
 * (item 9). No real analytics destination exists yet — the one "sink"
 * below just logs, the same "typed contract now, real implementation is
 * a one-file swap later" pattern as `lib/platform/contract.ts`. Nothing
 * here sends data anywhere over the network.
 *
 * **No PII in any event payload, by construction of the types below** —
 * every event carries only opaque IDs (`CampaignId`/`PartnerId`/
 * `StoryWorldId`/`AcquisitionSourceCode`) and booleans/enums, never a
 * name, email, or free-text field. Do not widen these types to accept a
 * raw string without checking this file's own doc comment first.
 */

interface BaseEventFields {
  campaignId?: CampaignId;
  partnerId?: PartnerId;
  storyWorldId?: StoryWorldId;
  acquisitionSource?: AcquisitionSourceCode;
}

export type ConversionEvent =
  | ({ type: "campaign_landing_viewed" } & BaseEventFields)
  | ({ type: "cta_clicked" } & BaseEventFields)
  | ({ type: "registration_started" } & BaseEventFields)
  | ({ type: "registration_completed" } & BaseEventFields)
  /** Not fired by any code path yet — no real trial-provisioning system
   * exists (see `lib/platform/contract.ts`'s doc comment). Defined now
   * so a future real activation has a stable event shape to emit,
   * exactly the "subscription outcome callback placeholder" the brief
   * asks for, applied here too since trial activation has the same
   * "depends on a backend that doesn't exist yet" status. */
  | ({ type: "trial_activated" } & BaseEventFields)
  /** Fired the moment this repo calls through to `PlatformClient.
   * startTrial` — i.e. the actual handoff to the future shared platform
   * backend's contract, not a real subscription outcome. */
  | ({ type: "subscription_handoff_started" } & BaseEventFields)
  /** Placeholder, per the brief — no subscription system exists to call
   * this back yet. Defined so the future shared platform backend has a
   * stable shape to report against once it exists; nothing in this repo
   * constructs or fires this today. */
  | ({ type: "subscription_outcome_placeholder" } & BaseEventFields & {
        outcome: "succeeded" | "failed" | "cancelled";
      })
  | ({ type: "reward_eligibility" } & BaseEventFields & {
        rewardType?: RewardType;
        state:
          "not-applicable" | "pending" | "eligible" | "issued" | "redeemed";
      });

export interface ConversionEventSink {
  track(event: ConversionEvent): void;
}

/** The one implementation that exists today — logs (server console or
 * browser devtools, depending on which side fires it) and nothing else.
 * Safe to call from both Server Actions/Components and client
 * components: no browser-only or Node-only API. Swapping in a real
 * destination (GA4, a first-party events endpoint, etc.) later is a
 * change to this one object, not to any call site. */
export const consoleConversionEventSink: ConversionEventSink = {
  track(event) {
    console.info("[conversion event]", event);
  },
};

/** The sink every call site should import — a single swap point for a
 * future real destination. */
export const conversionEvents: ConversionEventSink = consoleConversionEventSink;
