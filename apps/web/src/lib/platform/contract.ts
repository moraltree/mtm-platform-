import { sendEmail } from "../email";
import type { AttributionState } from "../attribution/types";
import type { RegistrationConsentState } from "../registrationConsent";
import type { RewardEligibilityMetadata } from "../rewards/types";
import { conversionEvents } from "../analytics/events";
import type {
  AcquisitionSourceCode,
  CampaignId,
  ContentId,
  PartnerId,
  StoryWorldId,
  UserId,
} from "./ids";

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

/** The registering adult's own identity — never the child's. See
 * `lib/registrationConsent.ts`'s doc comment for why this and consent
 * are kept as separate concerns within the same request. `country` is
 * optional: a future campaign/market configuration may already know it
 * (see `CampaignLandingProps.knownCountry`'s doc comment), in which case
 * the registration form doesn't ask; otherwise the registrant picks one. */
export interface AdultIdentity {
  firstName: string;
  lastName: string;
  email: string;
  /** ISO 3166-1 alpha-2 (e.g. "GB"), or undefined if genuinely unknown —
   * never fabricated. */
  country?: string;
}

/** Which offer/trial the registration is against — the minimum a future
 * shared backend needs to know what was promised, without this repo
 * owning entitlement/billing logic itself. Mirrors (a subset of)
 * `CampaignDoc.offer` (`lib/sanity/types.ts`) — kept as its own type
 * here rather than importing that one directly, since a Sanity document
 * shape and a platform-handoff payload are allowed to diverge over time
 * even though they start identical. */
export type OfferType =
  "free-trial" | "percentage-discount" | "fixed-offer" | "reward-linked";

const OFFER_TYPES: readonly OfferType[] = [
  "free-trial",
  "percentage-discount",
  "fixed-offer",
  "reward-linked",
];

/** Type guard for a raw string against the real `OfferType` union —
 * the one place anything reading `offerType` off untrusted input (a
 * client-editable hidden form field) should check it, rather than
 * casting with `as` and trusting the client. Returns `false` for
 * anything not in the union, including a future offer type this
 * deployed code doesn't know about yet — the caller's job is to treat
 * that the same as "unset," not to guess. */
export function isOfferType(value: string): value is OfferType {
  return (OFFER_TYPES as readonly string[]).includes(value);
}

export interface OfferIdentity {
  offerType?: OfferType;
  trialLengthDays?: number;
  discountPercentage?: number;
  /** Only meaningful when `offerType` is `"fixed-offer"` — see
   * `CampaignDoc.offer.fixedOfferLabel`'s own doc comment
   * (`lib/sanity/types.ts`), which this mirrors. */
  fixedOfferLabel?: string;
  discountCode?: string;
  stripePriceId?: string;
}

export interface StartTrialRequest {
  adult: AdultIdentity;
  campaignId: CampaignId;
  partnerId?: PartnerId;
  storyWorldId?: StoryWorldId;
  acquisitionSource?: AcquisitionSourceCode;
  offer?: OfferIdentity;
  /** Both halves, per the owner's Phase 1 decision — who originally
   * acquired this visitor (`attribution.first`, permanent) and what
   * brought them back this time (`attribution.latest`). This repo hands
   * off both; it does not collapse them into one before handing off,
   * since the shared backend is where the "acquired by X, reactivated
   * by Y" reporting questions actually get answered. */
  attribution: AttributionState;
  consent: RegistrationConsentState;
  /** Only present when the campaign is configured with a reward rule —
   * see `lib/rewards/types.ts`. Forwarded as-is; this repo never
   * evaluates or upgrades the state itself. */
  rewardEligibility?: RewardEligibilityMetadata;
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
 * `submitFreeTrialSignup` (validate elsewhere, email a human,
 * inert-until-configured on the same `FREE_TRIAL_TO_EMAIL`/
 * `CONTACT_FORM_FROM_EMAIL` env vars) — both the `/free30` action and
 * the generic `/start/[storyWorld]/[campaign]` action now call through
 * to this one implementation rather than each inlining their own
 * `sendEmail` call. Still notifies a human, nothing more: no account,
 * entitlement, subscription, or reward is created, stored, or fabricated
 * anywhere below.
 */
export const emailStandInPlatformClient: PlatformClient = {
  async startTrial({
    adult,
    campaignId,
    partnerId,
    storyWorldId,
    acquisitionSource,
    offer,
    attribution,
    consent,
    rewardEligibility,
  }) {
    const toEmail = process.env.FREE_TRIAL_TO_EMAIL;
    const fromEmail = process.env.CONTACT_FORM_FROM_EMAIL;

    if (!toEmail || !fromEmail) {
      console.warn(
        "startTrial (email stand-in) called but FREE_TRIAL_TO_EMAIL/" +
          "CONTACT_FORM_FROM_EMAIL aren't set — see .env.example. Lead " +
          `was NOT recorded anywhere: ${adult.email} (campaign=${campaignId}).`,
      );
      return {
        status: "error",
        message:
          "Sign-ups aren't fully connected yet — please try again shortly, or reach us via the contact page.",
      };
    }

    // Tracked only once an actual handoff attempt is under way (past the
    // config gate above) — firing these unconditionally at the top of
    // this function would record a "started" event for every submission
    // even on a deployment where `FREE_TRIAL_TO_EMAIL`/
    // `CONTACT_FORM_FROM_EMAIL` are permanently unset, inflating the
    // conversion funnel with handoffs that were never going to reach
    // anyone. A `sendEmail` failure past this point still counts as
    // "started" (a real attempt was made) — that distinction belongs to
    // a future outcome event, not to gating this one.
    conversionEvents.track({
      type: "subscription_handoff_started",
      campaignId,
      partnerId,
      storyWorldId,
      acquisitionSource,
    });
    if (rewardEligibility) {
      conversionEvents.track({
        type: "reward_eligibility",
        campaignId,
        partnerId,
        storyWorldId,
        acquisitionSource,
        rewardType: rewardEligibility.rewardType,
        state: rewardEligibility.state,
      });
    }

    const { first, latest } = attribution;
    const result = await sendEmail({
      to: toEmail,
      from: fromEmail,
      replyTo: adult.email,
      subject: `Trial sign-up — ${campaignId}`,
      text:
        `New trial sign-up via the campaign platform.\n\n` +
        `Name: ${adult.firstName} ${adult.lastName}\n` +
        `Email: ${adult.email}\n` +
        `Country: ${adult.country ?? "(not provided)"}\n` +
        `Campaign: ${campaignId}\n` +
        `Partner: ${partnerId ?? "(none)"}\n` +
        `Story World: ${storyWorldId ?? "(none)"}\n` +
        `Acquisition source: ${acquisitionSource ?? "(none)"}\n\n` +
        // A missing offerType means "free-trial" — the documented
        // default every existing campaign (created before this field
        // existed) actually has — not an unhelpful "(unspecified)".
        // See CampaignDoc.offer.offerType's own doc comment
        // (lib/sanity/types.ts) for the same claim; this is where it's
        // actually implemented.
        `Offer: ${offer?.offerType ?? "free-trial"}` +
        (offer?.trialLengthDays != null
          ? ` — ${offer.trialLengthDays} days`
          : "") +
        (offer?.discountPercentage != null
          ? ` — ${offer.discountPercentage}% off`
          : "") +
        (offer?.fixedOfferLabel ? ` — ${offer.fixedOfferLabel}` : "") +
        (offer?.discountCode ? ` — code ${offer.discountCode}` : "") +
        "\n\n" +
        `Consent — adult confirmed: ${consent.adultConfirmed}, guardian confirmed: ${consent.guardianConfirmed}\n` +
        `Terms accepted: ${consent.termsAccepted} (v${consent.termsVersion} @ ${consent.termsAcceptedAt})\n` +
        `Privacy accepted: ${consent.privacyAccepted} (v${consent.privacyVersion} @ ${consent.privacyAcceptedAt})\n` +
        `Marketing consent: ${consent.marketingConsent}` +
        (consent.marketingConsentAt ? ` @ ${consent.marketingConsentAt}` : "") +
        "\n\n" +
        (rewardEligibility
          ? `Reward eligibility: ${rewardEligibility.state}` +
            (rewardEligibility.rewardRuleKey
              ? ` (rule ${rewardEligibility.rewardRuleKey})`
              : "") +
            "\n\n"
          : "") +
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

    // Tracked here, server-side, rather than client-side off the Server
    // Action's returned `status` — the honeypot branch in both call
    // sites (CampaignLanding/actions.ts, /start/.../actions.ts) also
    // returns `{status: "success"}` without ever reaching this function,
    // so a client-side "fire on success" effect can't tell a genuine
    // completion apart from a deceived-bot (or accidentally-autofilled-
    // honeypot) short-circuit. Firing only here means this event fires
    // if and only if a real notification was actually sent.
    conversionEvents.track({
      type: "registration_completed",
      campaignId,
      partnerId,
      storyWorldId,
      acquisitionSource,
    });

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
