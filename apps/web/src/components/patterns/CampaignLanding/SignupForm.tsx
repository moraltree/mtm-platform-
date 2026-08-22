"use client";

import { useActionState, useEffect, useRef } from "react";
import { TextField, SelectField } from "@/components/ui/FormField";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { COUNTRY_OPTIONS } from "@/lib/countries";
import { conversionEvents } from "@/lib/analytics/events";
import type { CampaignId, PartnerId, StoryWorldId } from "@/lib/platform/ids";
import {
  submitFreeTrialSignup,
  initialFreeTrialSignupState,
  type FreeTrialSignupState,
} from "./actions";
import { cx } from "@/lib/cx";
import styles from "./CampaignLanding.module.css";

type SignupAction = (
  prevState: FreeTrialSignupState,
  formData: FormData,
) => Promise<FreeTrialSignupState>;

export interface SignupFormOfferHints {
  offerType?: string;
  trialLengthDays?: number;
  discountPercentage?: number;
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
}

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
}: SignupFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      conversionEvents.track({
        type: "registration_completed",
        campaignId: campaign as CampaignId,
        partnerId,
        storyWorldId,
      });
    }
  }, [state.status, campaign, partnerId, storyWorldId]);

  function trackRegistrationStarted() {
    if (hasStarted.current) return;
    hasStarted.current = true;
    conversionEvents.track({
      type: "registration_started",
      campaignId: campaign as CampaignId,
      partnerId,
      storyWorldId,
    });
  }

  function trackCtaClicked() {
    conversionEvents.track({
      type: "cta_clicked",
      campaignId: campaign as CampaignId,
      partnerId,
      storyWorldId,
    });
  }

  return (
    <form
      ref={formRef}
      action={formAction}
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
      {offer?.discountCode && (
        <input type="hidden" name="discountCode" value={offer.discountCode} />
      )}
      {offer?.rewardRuleKey && (
        <input type="hidden" name="rewardRuleKey" value={offer.rewardRuleKey} />
      )}
      {knownCountry && (
        <input type="hidden" name="country" value={knownCountry} />
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
            onChange={trackRegistrationStarted}
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
            {COUNTRY_OPTIONS.map((c) => (
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
                <Link href="/legal/terms-of-use" target="_blank">
                  Terms of Use
                </Link>{" "}
                and{" "}
                <Link href="/legal/privacy-policy" target="_blank">
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
