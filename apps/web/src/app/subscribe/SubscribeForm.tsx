"use client";

import { useActionState } from "react";
import { TextField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { createSubscriptionCheckout } from "./actions";
import {
  initialSubscribeCheckoutState,
  type SubscribeCheckoutState,
} from "./state";
import styles from "./subscribe.module.css";

export interface SubscribeFormProps {
  /** Pre-selected plan — passed from the parent page's URL param when set. */
  defaultPlan?: "MONTHLY" | "ANNUAL";
  /**
   * Advertised trial duration in days (0 = no trial, resolved server-side
   * from campaign config). The actual trial applied at checkout may differ
   * if the visitor is ineligible — this is purely a display hint.
   */
  trialDays?: number;
}

export function SubscribeForm({
  defaultPlan = "MONTHLY",
  trialDays = 0,
}: SubscribeFormProps) {
  const [state, dispatch, pending] = useActionState<
    SubscribeCheckoutState,
    FormData
  >(createSubscriptionCheckout, initialSubscribeCheckoutState);

  const hasTrial = trialDays > 0;
  const submitLabel = hasTrial
    ? `Start your ${trialDays}-day free trial`
    : "Start subscription";

  return (
    <form action={dispatch} className={styles.form} noValidate>
      {state.status === "error" && !state.fieldErrors && (
        <p className={styles.formError} role="alert">
          {state.message}
        </p>
      )}

      <fieldset className={styles.planGroup}>
        <legend className={styles.planLegend}>Choose your plan</legend>
        <label htmlFor="plan-monthly" aria-label="Monthly" className={styles.planOption}>
          <input
            id="plan-monthly"
            type="radio"
            name="plan"
            value="MONTHLY"
            defaultChecked={defaultPlan === "MONTHLY"}
            className={styles.planRadio}
          />
          <span className={styles.planLabel}>
            <span className={styles.planName}>Monthly</span>
          </span>
        </label>
        <label htmlFor="plan-annual" aria-label="Annual (save with annual billing)" className={styles.planOption}>
          <input
            id="plan-annual"
            type="radio"
            name="plan"
            value="ANNUAL"
            defaultChecked={defaultPlan === "ANNUAL"}
            className={styles.planRadio}
          />
          <span className={styles.planLabel}>
            <span className={styles.planName}>Annual</span>
            <span className={styles.planBadge}>Save with annual billing</span>
          </span>
        </label>
        {state.fieldErrors?.plan && (
          <p className={styles.fieldError}>{state.fieldErrors.plan}</p>
        )}
      </fieldset>

      <div className={styles.fields}>
        <TextField
          label="First name"
          name="firstName"
          autoComplete="given-name"
          required
          error={state.fieldErrors?.firstName}
        />
        <TextField
          label="Last name"
          name="lastName"
          autoComplete="family-name"
          required
          error={state.fieldErrors?.lastName}
        />
        <TextField
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          required
          error={state.fieldErrors?.email}
          className={styles.emailField}
        />
      </div>

      <p className={styles.billingNote}>
        {hasTrial
          ? `Your ${trialDays}-day free trial starts when you complete checkout. ` +
            `You'll enter your payment details now — your card will only be ` +
            `charged when your trial ends unless you cancel first.`
          : "You’ll be taken to Stripe to enter your payment details. No charge is made until you confirm at Stripe."}
      </p>

      <Button type="submit" disabled={pending} size="lg">
        {pending
          ? hasTrial
            ? "Starting your free trial…"
            : "Starting checkout…"
          : submitLabel}
      </Button>
    </form>
  );
}
