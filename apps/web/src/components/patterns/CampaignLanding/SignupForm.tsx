"use client";

import { useActionState, useEffect, useRef, type FocusEvent } from "react";
import { TextField, SelectField } from "@/components/ui/FormField";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { getEnabledCountries } from "@/lib/countries";
import { conversionEvents } from "@/lib/analytics/events";
import { asCampaignId } from "@/lib/platform/ids";
import type { PartnerId, StoryWorldId } from "@/lib/platform/ids";
import { submitFreeTrialSignup } from "./actions";
import {
  initialFreeTrialSignupState,
  type FreeTrialSignupState,
} from "./state";
import { cx } from "@/lib/cx";
import styles from "./CampaignLanding.module.css";

// Computed once at module scope — the enabled/disabled split doesn't
// change mid-session, so there's no reason to re-filter on every render.
// See lib/countries.ts's own doc comment for the single-source-of-truth
// architecture this reads from (and the future MTM Control Center
// hand-off it's designed for).
const ENABLED_COUNTRIES = getEnabledCountries();

type SignupAction = (
  prevState: FreeTrialSignupState,
  formData: FormData,
) => Promise<FreeTrialSignupState>;

export interface SignupFormOfferHints {
  offerType?: string;
  trialLengthDays?: number;
  discountPercentage?: number;
  fixedOfferLabel?: string;
  discountCode?: string;
  rewardRuleKey?: string;
}

export interface SignupFormProps {
  campaign: string;
  source?: string;
  ctaLabel: string;
  /** A second instance of this form appears lower on the page (the brief's
   * "repeat the primary CTA lower on the page") — ids must stay unique
   * per instance, hence this rather than a hardcoded id. */
  instanceId: string;
  className?: string;
  /** Overrides the default `/free30` Server Action — the generic
   * `/start/...` route supplies its own, attribution-aware action
   * instead (see that route's `actions.ts`). Defaults to
   * `submitFreeTrialSignup` below, `/free30`'s existing, unchanged
   * behaviour. */
  action?: SignupAction;
  initialState?: FreeTrialSignupState;
  /** Carried through as hidden fields so the Server Action can build a
   * full `StartTrialRequest` without querying Sanity itself — actions in
   * this codebase stay presentational/data-in, same rule
   * `PageSections`' components follow (see CLAUDE.md). `/free30` (no
   * Sanity-backed campaign document) never passes these. */
  partnerId?: PartnerId;
  storyWorldId?: StoryWorldId;
  offer?: SignupFormOfferHints;
  /** Already-known country (ISO 3166-1 alpha-2) from campaign/market
   * context — when set, the visible country selector is skipped and this
   * value travels as a hidden field instead, per the brief's "reuse
   * campaign/market context if it is already known" instruction. No
   * campaign/partner/Story-World document models a market/country field
   * yet, so nothing currently sets this — the code path is real, not a
   * stub, and starts working the moment such a field exists. */
  knownCountry?: string;
  /** The route slugs (not the durable `.key`s) the `/start/...` Server
   * Action needs to re-resolve this Campaign's authoritative Sanity
   * document before trusting anything from the `offer` hidden fields
   * below — see `submitCampaignSignup`'s own doc comment. `/free30`
   * passes neither (no Sanity-backed Campaign document exists for it),
   * and its own action never reads them. */
  storyWorldSlug?: string;
  campaignSlug?: string;
}

/** Cross-instance `registration_started` dedup — the hero and finalCta
 * sections each render their own `SignupForm` instance (see
 * `CampaignLanding.tsx`), so a visitor who focuses a field in one and
 * later submits the other would otherwise produce two events for one
 * registration. A plain module-scoped `Set`, not `sessionStorage`:
 * it's shared between both instances for the lifetime of this page
 * view (the same problem `sessionStorage` solved), but — unlike
 * `sessionStorage` — it resets on every fresh page load/navigation
 * rather than persisting for the rest of the browser session, so a
 * visitor who genuinely abandons and later returns to register for
 * real isn't silently suppressed by a stale flag from their first,
 * unfinished visit.
 */
const registrationStartedCampaigns = new Set<string>();

/** The one signup/registration form every campaign route shares —
 * `/free30` (WP8) and every campaign served through `/start/[storyWorld]/
 * [campaign]`. Registers the **adult** (parent/legal guardian), never
 * the child — see the required confirmations below. `campaign`/`source`
 * and the optional partner/Story-World/offer hints travel through as
 * hidden fields into whichever Server Action is in effect, so the
 * action can build a complete platform handoff without re-querying
 * content itself. */
export function SignupForm({
  campaign,
  source,
  ctaLabel,
  instanceId,
  className,
  action = submitFreeTrialSignup,
  initialState = initialFreeTrialSignupState,
  partnerId,
  storyWorldId,
  offer,
  knownCountry,
  storyWorldSlug,
  campaignSlug,
}: SignupFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const hasStarted = useRef(false);

  // Depends on the whole `state` object, not `state.status` — two
  // consecutive successful submissions in the same mounted form both
  // return `{status: "success", ...}`, and `useActionState` gives each
  // its own object, but comparing only the primitive `status` string
  // (`"success" === "success"`) would make React treat the second
  // completion as "nothing changed" and skip the reset. `registration_
  // completed` itself is tracked server-side now (see
  // `emailStandInPlatformClient.startTrial`'s own doc comment) —
  // firing it here off `state.status === "success"` couldn't
  // distinguish a genuine completion from the honeypot branch in both
  // Server Actions, which also returns `{status: "success"}` without
  // ever calling `startTrial`.
  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  function trackRegistrationStarted() {
    if (hasStarted.current) return;
    hasStarted.current = true;
    // See `registrationStartedCampaigns`' own doc comment above for why
    // this is a plain module-scoped `Set` rather than `sessionStorage`.
    if (registrationStartedCampaigns.has(campaign)) return;
    registrationStartedCampaigns.add(campaign);
    conversionEvents.track({
      type: "registration_started",
      campaignId: asCampaignId(campaign),
      partnerId,
      storyWorldId,
    });
  }

  // Fires on the first interaction with *any* real field (name/email/
  // country/checkboxes), not just `firstName` — a single `onChange` on
  // one field missed a visitor who fills lastName/email first, or whose
  // browser/password-manager autofill doesn't dispatch a per-field
  // `change` event the way typing does. `onFocusCapture` on the form
  // catches focus on the way in, before any change event, for every
  // descendant; the honeypot is explicitly excluded (it's off-screen and
  // out of tab order for real visitors, but a bot could still focus it
  // programmatically, and that shouldn't count as "a visitor started
  // registering"), and only real form controls count — a `Tab` landing
  // on the Terms/Privacy links shouldn't fire this either.
  function handleFormFocusCapture(event: FocusEvent<HTMLFormElement>) {
    const target = event.target;
    const isRealField =
      (target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement) &&
      target.name !== "company";
    if (isRealField) trackRegistrationStarted();
  }

  function trackCtaClicked() {
    conversionEvents.track({
      type: "cta_clicked",
      campaignId: asCampaignId(campaign),
      partnerId,
      storyWorldId,
    });
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onFocusCapture={handleFormFocusCapture}
      className={cx(styles.signupForm, className)}
      noValidate
    >
      {/* Honeypot — see actions.ts. Hidden off-screen, out of tab order and
          the accessibility tree, same pattern as ContactForm. */}
      <div className={styles.honeypot} aria-hidden="true">
        <label htmlFor={`company-${instanceId}`}>Company</label>
        <input
          id={`company-${instanceId}`}
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <input type="hidden" name="campaign" value={campaign} />
      <input type="hidden" name="source" value={source || ""} />
      {partnerId && <input type="hidden" name="partnerId" value={partnerId} />}
      {storyWorldId && (
        <input type="hidden" name="storyWorldId" value={storyWorldId} />
      )}
      {offer?.offerType && (
        <input type="hidden" name="offerType" value={offer.offerType} />
      )}
      {offer?.trialLengthDays != null && (
        <input
          type="hidden"
          name="trialLengthDays"
          value={offer.trialLengthDays}
        />
      )}
      {offer?.discountPercentage != null && (
        <input
          type="hidden"
          name="discountPercentage"
          value={offer.discountPercentage}
        />
      )}
      {offer?.fixedOfferLabel && (
        <input
          type="hidden"
          name="fixedOfferLabel"
          value={offer.fixedOfferLabel}
        />
      )}
      {offer?.discountCode && (
        <input type="hidden" name="discountCode" value={offer.discountCode} />
      )}
      {offer?.rewardRuleKey && (
        <input type="hidden" name="rewardRuleKey" value={offer.rewardRuleKey} />
      )}
      {knownCountry && (
        <input type="hidden" name="country" value={knownCountry} />
      )}
      {storyWorldSlug && (
        <input type="hidden" name="storyWorldSlug" value={storyWorldSlug} />
      )}
      {campaignSlug && (
        <input type="hidden" name="campaignSlug" value={campaignSlug} />
      )}

      {/* A slightly lighter card than the page's own cream/ivory
          background, so the form reads as a distinct, elevated element —
          see CampaignLanding.module.css's file comment. */}
      <div className={styles.signupCard}>
        <p className={styles.registrationIntro}>
          For the parent, guardian, or responsible adult — not the child.
        </p>

        <div className={styles.nameRow}>
          <TextField
            label="First name"
            name="firstName"
            autoComplete="given-name"
            required
            error={state.fieldErrors?.firstName}
            className={styles.signupField}
          />
          <TextField
            label="Last name"
            name="lastName"
            autoComplete="family-name"
            required
            error={state.fieldErrors?.lastName}
            className={styles.signupField}
          />
        </div>

        <TextField
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          required
          error={state.fieldErrors?.email}
          className={styles.signupField}
        />

        {!knownCountry && (
          <SelectField
            label="Country"
            name="country"
            autoComplete="country"
            className={styles.signupField}
            hint="Optional — helps us show the right offer."
          >
            <option value="">Select a country (optional)</option>
            {ENABLED_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </SelectField>
        )}

        <div className={styles.consentGroup}>
          <Checkbox
            name="adultConfirmed"
            required
            label="I am 18 or over."
            error={state.consentErrors?.adultConfirmed}
          />
          <Checkbox
            name="guardianConfirmed"
            required
            label="I am the parent, legal guardian, or responsible adult for the child using this service."
            error={state.consentErrors?.guardianConfirmed}
          />
          <Checkbox
            name="legalAccepted"
            required
            label={
              <>
                I accept the{" "}
                <Link
                  href="/legal/terms-of-use"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Terms of Use
                </Link>{" "}
                and{" "}
                <Link
                  href="/legal/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </Link>
                .
              </>
            }
            error={state.consentErrors?.legalAccepted}
          />
          <Checkbox
            name="marketingConsent"
            label="Send me Moral Tree Media news, launch offers, and relevant promotions. (Optional — you'll still receive account, trial, and subscription messages either way.)"
          />
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className={styles.signupButton}
          onClick={trackCtaClicked}
        >
          {pending ? "Sending…" : ctaLabel}
        </Button>
      </div>

      <p className={styles.reassurance}>
        No credit card today. Cancel anytime.
      </p>

      {state.status === "error" && state.message && (
        <p role="alert" className={styles.formError}>
          {state.message}
        </p>
      )}
      {state.status === "success" && state.message && (
        <p role="status" className={styles.formSuccess}>
          {state.message}
        </p>
      )}
    </form>
  );
}
