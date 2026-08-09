/**
 * Single source of truth for cookie-consent state, shared between
 * ConsentBanner and (later) any analytics/tracking script that needs to
 * check consent before loading. No analytics exist yet — this only
 * persists the user's choice and notifies listeners of changes.
 */

export type ConsentChoice = "accepted" | "declined";

export const CONSENT_STORAGE_KEY = "mtm-cookie-consent";
export const CONSENT_CHANGE_EVENT = "mtm-consent-change";

export function getStoredConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  return value === "accepted" || value === "declined" ? value : null;
}

export function setStoredConsent(choice: ConsentChoice) {
  window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  window.dispatchEvent(
    new CustomEvent(CONSENT_CHANGE_EVENT, { detail: choice }),
  );
}
