"use server";

import { cookies, headers } from "next/headers";
import type { FreeTrialSignupState } from "@/components/patterns/CampaignLanding/actions";
import {
  FIRST_TOUCH_COOKIE_NAME,
  LATEST_TOUCH_COOKIE_NAME,
  parseAttributionCookie,
} from "@/lib/attribution/cookie";
import { buildFallbackAttributionPayload } from "@/lib/attribution/fallback";
import { buildRegistrationConsentState } from "@/lib/registrationConsent";
import {
  optionalString,
  parseAndValidateRegistration,
} from "@/lib/registration/validate";
import type { AttributionPayload } from "@/lib/attribution/types";
import {
  asAcquisitionSourceCode,
  asPartnerId,
  asRewardRuleKey,
  asStoryWorldId,
} from "@/lib/platform/ids";
import { emailStandInPlatformClient } from "@/lib/platform/contract";
import type { OfferIdentity } from "@/lib/platform/contract";
import type { RewardEligibilityMetadata } from "@/lib/rewards/types";
import { isRegistrationRateLimited } from "@/lib/registration/rateLimit";
import { getCampaignForRoute } from "@/lib/sanity/queries";

// A "use server" file may only export async functions (Next.js build-
// time rule) — the shared idle initial state
// (`initialFreeTrialSignupState`, `{status: "idle"}`) lives in
// CampaignLanding/actions.ts and is reused directly by this route's
// page.tsx rather than re-declared as a second object export here.

/**
 * The generic `/start/[storyWorld]/[campaign]` route's registration
 * action — everything `components/patterns/CampaignLanding/actions.ts`'s
 * `submitFreeTrialSignup` does (validate the adult registration + consent,
 * honeypot, rate-limit, notify a human via
 * `emailStandInPlatformClient.startTrial` — no real trial provisioning;
 * see that file's own doc comment), but carrying both first-touch and
 * latest-touch attribution (see lib/attribution) plus the partner/
 * Story-World identity the campaign's own page.tsx put on the form as
 * hidden fields (see that route's SignupForm props). Unlike every other
 * "actions stay presentational" Server Action in this codebase, this one
 * *does* re-query Sanity — via `getCampaignForRoute` — but only to
 * re-resolve the offer/reward data (see below); it still never queries
 * for anything the hidden fields already carry safely (partner/
 * Story-World identity, attribution).
 *
 * Reads the two attribution cookies (already set by `src/proxy.ts` on
 * landing) as the source of truth for `partnerId`/`storyWorldId`/
 * `acquisitionSource`; the hidden `campaign` field (and, in the two
 * cookies' absence, the hidden `partnerId`/`storyWorldId` fields the page
 * also sets) is the fallback for a visitor whose cookies were blocked or
 * cleared between landing and submitting — same "cookie is the source of
 * truth, hidden fields are the fallback" rule the architecture
 * proposal's attribution model describes, not a second, competing
 * source.
 */
export async function submitCampaignSignup(
  _prevState: FreeTrialSignupState,
  formData: FormData,
): Promise<FreeTrialSignupState> {
  // Honeypot — see CampaignLanding/actions.ts for the same pattern/rationale.
  if (formData.get("company")) {
    return {
      status: "success",
      message: "You're on the list — we'll be in touch.",
    };
  }

  const campaignFromForm = optionalString(formData, "campaign") ?? "";

  const { values, consentInput, fieldErrors, consentErrors, isValid } =
    parseAndValidateRegistration(formData);

  if (!isValid) {
    return {
      status: "error",
      fieldErrors,
      consentErrors,
      message: "Please fix the errors below.",
    };
  }

  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  if (isRegistrationRateLimited(ip)) {
    return {
      status: "error",
      message: "Too many submissions — please try again in a few minutes.",
    };
  }

  const cookieStore = await cookies();
  const existingFirst = parseAttributionCookie(
    cookieStore.get(FIRST_TOUCH_COOKIE_NAME)?.value,
  );
  const existingLatest = parseAttributionCookie(
    cookieStore.get(LATEST_TOUCH_COOKIE_NAME)?.value,
  );

  // Lazy: only pay for `buildFallbackAttributionPayload`'s
  // `randomUUID()`/`Date` work when a cookie is actually missing — the
  // common case (both cookies present) skips it entirely. Still exactly
  // one fallback object shared by both `first`/`latest` when neither
  // cookie exists (the same touch, not two independently-timestamped
  // ones) — see `buildFallbackAttributionPayload`'s own doc comment.
  const attribution: { first: AttributionPayload; latest: AttributionPayload } =
    existingFirst && existingLatest
      ? { first: existingFirst, latest: existingLatest }
      : (() => {
          const fallback = buildFallbackAttributionPayload(campaignFromForm);
          return {
            first: existingFirst ?? fallback,
            latest: existingLatest ?? fallback,
          };
        })();

  // Prefer the cookie-derived identifiers (the authoritative source —
  // see this function's own doc comment); fall back to the hidden form
  // fields the page also set from the same Campaign document, for a
  // visitor whose cookies were blocked/cleared.
  const partnerIdRaw =
    attribution.latest.partnerId ?? optionalString(formData, "partnerId");
  const storyWorldIdRaw =
    attribution.latest.storyWorldId ?? optionalString(formData, "storyWorldId");
  const acquisitionSourceRaw =
    attribution.latest.acquisitionSource ?? optionalString(formData, "source");

  // The `offer`/`rewardRuleKey` hidden fields the page also renders are
  // client-editable and never trusted for the actual offer/reward data
  // below — a visitor could otherwise spoof e.g. `offerType=
  // "reward-linked"` on a campaign really configured as "free-trial" and
  // have that fabricated reward eligibility reach the internal
  // notification email. Instead, re-resolve this campaign's
  // *authoritative* Sanity document from the route slugs (also hidden
  // fields, but only ever used as a lookup key, never as the offer data
  // itself) via the same `getCampaignForRoute` the page itself already
  // called — same "never trust the client for anything with a real
  // business-rule consequence" cross-check WP7's checkout action applies
  // to `stripePriceId` (see CLAUDE.md's Shop price-drift section). A
  // missing/unresolvable campaign (slugs absent, or the campaign has
  // since gone inactive) degrades to no offer/reward data rather than
  // falling back to the untrusted hidden fields.
  const storyWorldSlug = optionalString(formData, "storyWorldSlug");
  const campaignSlugForm = optionalString(formData, "campaignSlug");
  const campaignDoc =
    storyWorldSlug && campaignSlugForm
      ? await getCampaignForRoute(storyWorldSlug, campaignSlugForm)
      : null;

  const offer: OfferIdentity = {
    offerType: campaignDoc?.offer?.offerType,
    trialLengthDays: campaignDoc?.offer?.trialLengthDays,
    discountPercentage: campaignDoc?.offer?.discountPercentage,
    fixedOfferLabel: campaignDoc?.offer?.fixedOfferLabel,
    discountCode: campaignDoc?.offer?.discountCode,
  };

  // Only meaningful (and only trusted) when the campaign's own offerType
  // is actually "reward-linked" — a stale `rewardRuleKey` left over
  // after an editor switches a campaign back to e.g. "free-trial" (the
  // two fields aren't mutually exclusive in the schema) must not still
  // report reward eligibility.
  const rewardRuleKeyRaw = campaignDoc?.offer?.rewardRuleKey;
  const rewardEligibility: RewardEligibilityMetadata | undefined =
    offer.offerType === "reward-linked" && rewardRuleKeyRaw
      ? {
          rewardRuleKey: asRewardRuleKey(rewardRuleKeyRaw),
          state: "pending",
        }
      : undefined;

  const consent = buildRegistrationConsentState(consentInput);

  const result = await emailStandInPlatformClient.startTrial({
    adult: {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      country: values.country || undefined,
    },
    // The cookie-derived value (via `attribution.latest`, which
    // `buildFallbackAttributionPayload` already seeds from
    // `campaignFromForm` when no cookie exists) is authoritative — same
    // "cookie wins, hidden field is only the fallback that feeds it"
    // rule this function's own doc comment describes for
    // partner/Story-World/acquisition-source, now applied consistently
    // to campaignId too rather than reading the tamperable hidden field
    // a second, competing time.
    campaignId: attribution.latest.campaignId,
    partnerId: partnerIdRaw ? asPartnerId(partnerIdRaw) : undefined,
    storyWorldId: storyWorldIdRaw ? asStoryWorldId(storyWorldIdRaw) : undefined,
    acquisitionSource: acquisitionSourceRaw
      ? asAcquisitionSourceCode(acquisitionSourceRaw)
      : undefined,
    offer,
    attribution,
    consent,
    rewardEligibility,
  });

  if (result.status === "error") {
    return { status: "error", message: result.message };
  }

  return { status: "success", message: result.message };
}
