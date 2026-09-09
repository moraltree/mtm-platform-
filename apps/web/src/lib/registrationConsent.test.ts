import { describe, expect, it } from "vitest";
import {
  buildRegistrationConsentState,
  validateRegistrationConsent,
  CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_VERSION,
  type RegistrationConsentInput,
} from "./registrationConsent";

const fullyConsented: RegistrationConsentInput = {
  adultConfirmed: true,
  guardianConfirmed: true,
  legalAccepted: true,
  marketingConsent: false,
};

describe("validateRegistrationConsent", () => {
  it("returns no errors when every required confirmation is given", () => {
    expect(validateRegistrationConsent(fullyConsented)).toEqual({});
  });

  it("requires adult confirmation", () => {
    const errors = validateRegistrationConsent({
      ...fullyConsented,
      adultConfirmed: false,
    });
    expect(errors.adultConfirmed).toBeTruthy();
  });

  it("requires guardian confirmation", () => {
    const errors = validateRegistrationConsent({
      ...fullyConsented,
      guardianConfirmed: false,
    });
    expect(errors.guardianConfirmed).toBeTruthy();
  });

  it("requires Terms/Privacy acceptance", () => {
    const errors = validateRegistrationConsent({
      ...fullyConsented,
      legalAccepted: false,
    });
    expect(errors.legalAccepted).toBeTruthy();
  });

  it("never requires marketing consent", () => {
    const errors = validateRegistrationConsent({
      ...fullyConsented,
      marketingConsent: false,
    });
    expect(errors).toEqual({});
  });
});

describe("buildRegistrationConsentState", () => {
  const now = new Date("2026-08-22T12:00:00.000Z");

  it("stamps terms/privacy acceptance from the single legalAccepted checkbox", () => {
    const state = buildRegistrationConsentState(fullyConsented, now);
    expect(state.termsAccepted).toBe(true);
    expect(state.privacyAccepted).toBe(true);
    expect(state.termsVersion).toBe(CURRENT_TERMS_VERSION);
    expect(state.privacyVersion).toBe(CURRENT_PRIVACY_VERSION);
    expect(state.termsAcceptedAt).toBe(now.toISOString());
    expect(state.privacyAcceptedAt).toBe(now.toISOString());
  });

  it("keeps marketing consent separate and unchecked by default", () => {
    const state = buildRegistrationConsentState(fullyConsented, now);
    expect(state.marketingConsent).toBe(false);
    expect(state.marketingConsentAt).toBeUndefined();
  });

  it("stamps marketingConsentAt only when marketing consent was actually given", () => {
    const state = buildRegistrationConsentState(
      { ...fullyConsented, marketingConsent: true },
      now,
    );
    expect(state.marketingConsent).toBe(true);
    expect(state.marketingConsentAt).toBe(now.toISOString());
  });

  it("does not couple marketing consent to service consent", () => {
    // A registrant can decline marketing while still completing
    // registration (service consent given) — the two flags are
    // independent, not one gating the other.
    const state = buildRegistrationConsentState(
      { ...fullyConsented, marketingConsent: false },
      now,
    );
    expect(state.termsAccepted).toBe(true);
    expect(state.marketingConsent).toBe(false);
  });
});
