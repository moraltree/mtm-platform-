import { sendEmail } from "../email";
import type { AttributionState } from "../attribution/types";
import type { CampaignId, ContentId, StoryWorldId, UserId } from "./ids";

/**
 * The typed contract this repository should call for everything the
 * architecture proposal assigns to the shared platform backend or the
 * external audiobook platform — accounts, auth, entitlements, real
 * trial provisioning, subscriptions, catalogue. **None of the real
 * services behind this contract exist yet** (see the architecture
 * proposal §§1c, 6, 17). This file exists so the campaign platform is
 * written against a stable interface now, and swapping the stand-in
 * implementation below for a real HTTP client later is a one-file
 * change, not a redesign of every call site.
 *
 * Per the owner's explicit instruction: do not build a substitute
 * authentication/entitlement/account/subscription system here. The one
 * implementation in this file (`emailStandInPlatformClient`) does
 * exactly what today's live `/free30` signup already does — notify a
 * human, nothing more — wearing this interface's shape so a future real
 * implementation is a drop-in. It does not create, store, or fake an
 * account, entitlement, or subscription record anywhere. Every method
 * this repo cannot honestly answer without a real backend throws
 * `NotImplementedError` instead of fabricating a response — see
 * `getEntitlements`/`getCatalogue` below.
 */

export class NotImplementedError extends Error {
  constructor(method: string) {
    super(
      `${method} requires the shared platform backend, which does not exist yet ` +
        "(see the architecture proposal §§1c, 6, 17). Do not implement a " +
        "substitute here — this is a genuine blocked dependency, not a bug.",
    );
    this.name = "NotImplementedError";
  }
}

export interface StartTrialRequest {
  email: string;
  campaignId: CampaignId;
  /** Both halves, per the owner's Phase 1 decision — who originally
   * acquired this visitor (`attribution.first`, permanent) and what
   * brought them back this time (`attribution.latest`). This repo hands
   * off both; it does not collapse them into one before handing off,
   * since the shared backend is where the "acquired by X, reactivated
   * by Y" reporting questions actually get answered. */
  attribution: AttributionState;
}

export interface StartTrialResult {
  status: "pending-manual-follow-up" | "error";
  /** User-facing copy for whatever the platform route renders next —
   * today always a "we'll be in touch" message; once the real backend
   * exists this may instead carry a redirect target (e.g. into the
   * audiobook platform once an account/entitlement is actually granted). */
  message: string;
}

export interface EntitlementSummary {
  storyWorldId: StoryWorldId;
  status: "trialing" | "active" | "expired" | "cancelled";
  expiresAt?: string;
}

export interface CatalogueEntry {
  contentId: ContentId;
  title: string;
}

/**
 * Everything this repository will eventually need from the shared
 * platform backend / audiobook platform. See the architecture
 * proposal's §6 for the endpoint shapes this interface is standing in
 * for (`POST /platform/trial/start`, `POST /platform/attribution/
 * handoff`, `GET /platform/entitlements/:user_id`, `GET /platform/
 * catalogue`).
 */
export interface PlatformClient {
  /** Today: notifies a human (no account/entitlement created). Once the
   * real backend exists: creates or matches an account and grants a
   * trial entitlement. */
  startTrial(request: StartTrialRequest): Promise<StartTrialResult>;

  /** Hands already-captured first-touch + latest-touch attribution to
   * the system that will own it long-term, at the moment of conversion.
   * This repo keeps no copy after calling this — see the architecture
   * proposal's attribution model. Today: not implemented (there is
   * nowhere to hand it off to yet); the caller should not block on this
   * failing. */
  handoffAttribution(
    payload: AttributionState & { email: string },
  ): Promise<void>;

  /** Never fabricate this — see this file's own doc comment. */
  getEntitlements(userId: UserId): Promise<EntitlementSummary[]>;

  /** Never fabricate this — content lives on the external audiobook
   * platform, not in this repository. */
  getCatalogue(storyWorldId: StoryWorldId): Promise<CatalogueEntry[]>;
}

/**
 * The one implementation that exists in this phase. Mirrors the inline
 * logic in `components/patterns/CampaignLanding/actions.ts`'s
 * `submitFreeTrialSignup` today (validate elsewhere, email a human,
 * inert-until-configured on the same `FREE_TRIAL_TO_EMAIL`/
 * `CONTACT_FORM_FROM_EMAIL` env vars) — this file does not change that
 * action in Phase 0. Wiring the action to call this instead of its own
 * inline `sendEmail` call is Phase 1 migration work (see the
 * architecture proposal's migration plan, step 6), not done here.
 */
export const emailStandInPlatformClient: PlatformClient = {
  async startTrial({ email, campaignId, attribution }) {
    const toEmail = process.env.FREE_TRIAL_TO_EMAIL;
    const fromEmail = process.env.CONTACT_FORM_FROM_EMAIL;

    if (!toEmail || !fromEmail) {
      console.warn(
        "startTrial (email stand-in) called but FREE_TRIAL_TO_EMAIL/" +
          "CONTACT_FORM_FROM_EMAIL aren't set — see .env.example. Lead " +
          `was NOT recorded anywhere: ${email} (campaign=${campaignId}).`,
      );
      return {
        status: "error",
        message:
          "Sign-ups aren't fully connected yet — please try again shortly.",
      };
    }

    const { first, latest } = attribution;
    const result = await sendEmail({
      to: toEmail,
      from: fromEmail,
      replyTo: email,
      subject: `Trial sign-up — ${campaignId}`,
      text:
        `New trial sign-up via the campaign platform.\n\n` +
        `Email: ${email}\nCampaign: ${campaignId}\n\n` +
        `Originally acquired via (first touch, ${first.touchedAt}):\n` +
        `  Partner: ${first.partnerId ?? "(none)"}\n` +
        `  Story World: ${first.storyWorldId ?? "(none)"}\n` +
        `  Acquisition source: ${first.acquisitionSource ?? "(none)"}\n` +
        `  UTM: ${JSON.stringify(first.utm)}\n` +
        `  Attribution ref: ${first.attributionRef}\n\n` +
        `Most recently returned via (latest touch, ${latest.touchedAt}):\n` +
        `  Partner: ${latest.partnerId ?? "(none)"}\n` +
        `  Story World: ${latest.storyWorldId ?? "(none)"}\n` +
        `  Acquisition source: ${latest.acquisitionSource ?? "(none)"}\n` +
        `  UTM: ${JSON.stringify(latest.utm)}\n` +
        `  Attribution ref: ${latest.attributionRef}\n`,
    });

    if (!result.ok) {
      console.error(
        "startTrial (email stand-in) notification failed:",
        result.error,
      );
      return {
        status: "error",
        message: "Something went wrong — please try again.",
      };
    }

    return {
      status: "pending-manual-follow-up",
      message: "You're on the list! We'll be in touch to get things set up.",
    };
  },

  async handoffAttribution(payload) {
    // No system exists to hand this off to yet — see this file's doc
    // comment. Logging, not persisting: this repository is not the
    // system of record for attribution history (see the architecture
    // proposal's attribution model).
    console.info(
      "handoffAttribution called with no shared backend configured — " +
        "this payload is not being stored anywhere " +
        `(first=${payload.first.attributionRef}, latest=${payload.latest.attributionRef}).`,
    );
  },

  async getEntitlements() {
    throw new NotImplementedError("getEntitlements");
  },

  async getCatalogue() {
    throw new NotImplementedError("getCatalogue");
  },
};
