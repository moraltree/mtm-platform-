import type { RegistrationConsentInput } from "../registrationConsent";
import { validateRegistrationConsent } from "../registrationConsent";

/**
 * Shared form-parsing/validation for the adult registration form —
 * used by both `/free30`'s Server Action
 * (`components/patterns/CampaignLanding/actions.ts`) and the generic
 * `/start/[storyWorld]/[campaign]` route's
 * (`app/start/[storyWorld]/[campaign]/actions.ts`), so the two don't
 * drift into two different definitions of "a valid registration." Pure
 * — no cookies/headers/env access, so it's trivially unit-testable (see
 * `validate.test.ts`).
 */

export interface RegistrationFieldValues {
  firstName: string;
  lastName: string;
  email: string;
  /** ISO 3166-1 alpha-2, or "" if the visitor left the (optional)
   * selector unset. */
  country: string;
}

export type RegistrationFieldErrors = Partial<
  Record<"firstName" | "lastName" | "email", string>
>;

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Reads the plain text fields off a submitted registration form.
 * Deliberately does not read the consent checkboxes — see
 * `parseConsentInput` below, kept separate so a caller that only needs
 * one half doesn't have to import the other's types. */
export function parseRegistrationFields(
  formData: FormData,
): RegistrationFieldValues {
  return {
    firstName: String(formData.get("firstName") || "").trim(),
    lastName: String(formData.get("lastName") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    country: String(formData.get("country") || "").trim(),
  };
}

export function validateRegistrationFields(
  values: RegistrationFieldValues,
): RegistrationFieldErrors {
  const errors: RegistrationFieldErrors = {};
  if (!values.firstName) errors.firstName = "Enter your first name.";
  if (!values.lastName) errors.lastName = "Enter your last name.";
  if (!values.email || !isValidEmail(values.email)) {
    errors.email = "Enter a valid email address.";
  }
  return errors;
}

/** HTML checkboxes only appear in `FormData` at all when checked — an
 * unchecked box is simply absent, not `"false"`. */
function isChecked(formData: FormData, name: string): boolean {
  return formData.get(name) != null;
}

export function parseConsentInput(
  formData: FormData,
): RegistrationConsentInput {
  return {
    adultConfirmed: isChecked(formData, "adultConfirmed"),
    guardianConfirmed: isChecked(formData, "guardianConfirmed"),
    legalAccepted: isChecked(formData, "legalAccepted"),
    marketingConsent: isChecked(formData, "marketingConsent"),
  };
}

export interface ParsedRegistration {
  values: RegistrationFieldValues;
  consentInput: RegistrationConsentInput;
  fieldErrors: RegistrationFieldErrors;
  consentErrors: ReturnType<typeof validateRegistrationConsent>;
  isValid: boolean;
}

/** The one function both Server Actions actually call — parses every
 * field + consent checkbox and validates all of it in one pass. */
export function parseAndValidateRegistration(
  formData: FormData,
): ParsedRegistration {
  const values = parseRegistrationFields(formData);
  const consentInput = parseConsentInput(formData);
  const fieldErrors = validateRegistrationFields(values);
  const consentErrors = validateRegistrationConsent(consentInput);
  const isValid =
    Object.keys(fieldErrors).length === 0 &&
    Object.keys(consentErrors).length === 0;

  return { values, consentInput, fieldErrors, consentErrors, isValid };
}
