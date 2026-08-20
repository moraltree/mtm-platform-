"use client";

import { useActionState, useEffect, useRef } from "react";
import { TextField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { submitFreeTrialSignup, initialFreeTrialSignupState } from "./actions";
import { cx } from "@/lib/cx";
import styles from "./CampaignLanding.module.css";

export interface SignupFormProps {
  campaign: string;
  source?: string;
  ctaLabel: string;
  /** A second instance of this form appears lower on the page (the brief's
   * "repeat the primary CTA lower on the page") — ids must stay unique
   * per instance, hence this rather than a hardcoded id. */
  instanceId: string;
  className?: string;
}

/** The one signup form every campaign route shares (currently just
 * `/free30` — see CampaignLanding's doc comment for the intended
 * `/blackpool`/`/pampers`/`/chester-zoo` reuse). `campaign` and `source`
 * travel through as hidden fields into the Server Action
 * (components/patterns/CampaignLanding/actions.ts) precisely so a future
 * analytics integration has real per-campaign/per-source data to key off
 * from day one, not something bolted on later. */
export function SignupForm({
  campaign,
  source,
  ctaLabel,
  instanceId,
  className,
}: SignupFormProps) {
  const [state, formAction, pending] = useActionState(
    submitFreeTrialSignup,
    initialFreeTrialSignupState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

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

      {/* A light card, not the bare dark section background: FormField's
          own error text (--color-danger) is only audited/legible against
          the light --color-surface family — see CampaignLanding.module.css's
          file comment — so the field needs a light surface under it
          regardless of which section (hero or the dark finalCta) this
          form instance renders in. */}
      <div className={styles.signupCard}>
        <div className={styles.signupRow}>
          <TextField
            label="Email address"
            hideLabel
            name="email"
            type="email"
            placeholder="Your email address"
            autoComplete="email"
            required
            error={state.fieldErrors?.email}
            className={styles.signupField}
          />
          <Button
            type="submit"
            size="lg"
            disabled={pending}
            className={styles.signupButton}
          >
            {pending ? "Sending…" : ctaLabel}
          </Button>
        </div>
      </div>

      <p className={styles.reassurance}>
        No credit card today · Cancel anytime
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
