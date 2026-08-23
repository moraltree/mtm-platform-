/**
 * The Contact page's enquiry-type context — 24 Aug 2026 refinement
 * sprint ("Publishing, Animation and other enquiry buttons currently
 * route to the same generic Contact page... make it context-aware").
 * One reusable Contact page/form still handles every enquiry (no
 * duplicate forms per page, per the brief) — this just labels which
 * button sent the visitor, both visibly (a badge on the form) and in
 * the notification email's subject line, via a `?type=` query param
 * read by `app/contact/page.tsx` and a matching hidden form field
 * `ContactForm`/`actions.ts` carry through to the email. An unknown or
 * missing value degrades to `"general"` — never a broken/blank label.
 */

export const ENQUIRY_TYPES = {
  general: "General enquiry",
  publishing: "Publishing enquiry",
  audiobooks: "Audiobooks enquiry",
  animation: "Animation enquiry",
  subscribe: "Subscription enquiry",
  partnership: "Partnership enquiry",
} as const;

export type EnquiryType = keyof typeof ENQUIRY_TYPES;

export function isEnquiryType(value: string): value is EnquiryType {
  return Object.hasOwn(ENQUIRY_TYPES, value);
}

/** Parses a raw query-param value (or any untrusted string) into a real
 * `EnquiryType`, defaulting to `"general"` for anything unrecognised —
 * never lets an arbitrary query string reach the email subject line
 * unvalidated. */
export function parseEnquiryType(value: string | undefined): EnquiryType {
  return value && isEnquiryType(value) ? value : "general";
}
