/**
 * Typed consent state captured at adult registration — deliberately a
 * separate module/type from `lib/consent.ts` (cookie-banner essential-
 * cookies consent). The two are unrelated concerns: `lib/consent.ts`
 * gates whether a tracking script may load in the browser; this module
 * is the legal/marketing consent record a registering adult gives, which
 * travels into `StartTrialRequest` (`lib/platform/contract.ts`) and on
 * to the future shared platform backend. Do not import one where the
 * other is meant, and do not merge them into one object later — see the
 * owner's explicit instruction to keep them apart.
 *
 * Three separate ideas, not one "I agree" checkbox:
 * - **Adult/guardian confirmation** (`adultConfirmed`, `guardianConfirmed`)
 *   — the child-safety guardrail (item 8): this service is registered by
 *   an adult on a child's behalf, never by the child.
 * - **Service consent** (`termsAccepted`/`privacyAccepted`) — required to
 *   use the service at all. The registration form presents this as one
 *   combined "I accept the Terms of Use and Privacy Policy" checkbox
 *   (avoids the dark-pattern of two near-identical mandatory checkboxes
 *   for one action), but the contract keeps both flags — and both
 *   versions/timestamps — distinct, since Terms and Privacy are separate
 *   documents that could change independently in future.
 * - **Marketing consent** (`marketingConsent`) — always optional, always
 *   unchecked by default, never required to complete registration or to
 *   receive operational/service communications (trial reminders,
 *   subscription information, service notices) — those are handled by
 *   the future shared platform as service messages, not marketing, and
 *   must not be gated on this flag.
 */

/** Hand-maintained, same pattern as `lib/campaignRoutes.ts`'s route
 * registry — bump whenever the legal team publishes a materially
 * different Terms of Use / Privacy Policy so newly-recorded consent is
 * traceable to the exact copy the registrant saw. Not sourced from the
 * Sanity `legalPage` documents' own `effectiveDate` today: campaign
 * routes don't currently fetch those documents (see CLAUDE.md's
 * null-handling rules — legal pages are looked up by slug on their own
 * route only), and wiring that in is a larger change than this contract
 * needs to make right now. Revisit if/when a campaign route starts
 * rendering real Terms/Privacy copy inline instead of just linking out. */
export const CURRENT_TERMS_VERSION = "2026-08-22";
export const CURRENT_PRIVACY_VERSION = "2026-08-22";

export interface RegistrationConsentState {
  /** "I am 18 or over." Required — see item 8's child-safety guardrail. */
  adultConfirmed: boolean;
  /** "I am the parent, legal guardian, or responsible adult for the
   * child using this service." Required, and deliberately a second,
   * distinct confirmation from `adultConfirmed` — an adult who is not
   * the responsible guardian is still not who this service is for. */
  guardianConfirmed: boolean;
  termsAccepted: boolean;
  termsVersion: string;
  termsAcceptedAt: string;
  privacyAccepted: boolean;
  privacyVersion: string;
  privacyAcceptedAt: string;
  /** Optional, unchecked by default. Never required for registration and
   * never a precondition for operational/service communications. */
  marketingConsent: boolean;
  /** Only set when `marketingConsent` is true — no timestamp for a
   * consent that was never given. */
  marketingConsentAt?: string;
}

export interface RegistrationConsentInput {
  adultConfirmed: boolean;
  guardianConfirmed: boolean;
  /** The single "I accept the Terms of Use and Privacy Policy" checkbox
   * the form actually renders — see this file's own doc comment for why
   * one checkbox still produces two independently-versioned acceptance
   * records. */
  legalAccepted: boolean;
  marketingConsent: boolean;
}

/** Pure — builds the full typed consent record from what the form
 * collected, stamping both acceptance timestamps at the same instant
 * (the single checkbox covers both documents at once) and only stamping
 * `marketingConsentAt` when consent was actually given. */
export function buildRegistrationConsentState(
  input: RegistrationConsentInput,
  now: Date = new Date(),
): RegistrationConsentState {
  const nowIso = now.toISOString();
  return {
    adultConfirmed: input.adultConfirmed,
    guardianConfirmed: input.guardianConfirmed,
    termsAccepted: input.legalAccepted,
    termsVersion: CURRENT_TERMS_VERSION,
    termsAcceptedAt: nowIso,
    privacyAccepted: input.legalAccepted,
    privacyVersion: CURRENT_PRIVACY_VERSION,
    privacyAcceptedAt: nowIso,
    marketingConsent: input.marketingConsent,
    marketingConsentAt: input.marketingConsent ? nowIso : undefined,
  };
}

export interface RegistrationConsentErrors {
  adultConfirmed?: string;
  guardianConfirmed?: string;
  legalAccepted?: string;
}

/** Pure — validates only the consent-related required fields (name/
 * email validation lives in `lib/registration/validate.ts`). Marketing
 * consent has no validation: it is optional by definition, so there is
 * no invalid state for it to be in. */
export function validateRegistrationConsent(
  input: RegistrationConsentInput,
): RegistrationConsentErrors {
  const errors: RegistrationConsentErrors = {};
  if (!input.adultConfirmed) {
    errors.adultConfirmed = "Please confirm you are 18 or over.";
  }
  if (!input.guardianConfirmed) {
    errors.guardianConfirmed =
      "Please confirm you are the parent, legal guardian, or responsible adult for the child using this service.";
  }
  if (!input.legalAccepted) {
    errors.legalAccepted = "Please accept the Terms of Use and Privacy Policy.";
  }
  return errors;
}
