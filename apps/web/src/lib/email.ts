const RESEND_API_URL = "https://api.resend.com/emails";

/** Minimal "is this shaped like an email address" check — deliberately
 * not RFC 5322-exhaustive, matching what every actual consumer needs
 * (ContactForm, the registration form) rather than a stricter validator
 * neither asked for. The one definition every form-with-an-email-field
 * in this codebase should import, rather than each declaring its own
 * copy (found duplicated three times across ContactForm/actions.ts,
 * CampaignLanding/actions.ts, and lib/registration/validate.ts before
 * this consolidation). */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export interface SendEmailInput {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  error?: string;
}

/**
 * Plain `fetch` against Resend's API — no SDK dependency, matching the
 * project's existing preference (see ContactForm/actions.ts, which has
 * a near-identical inline call not yet consolidated to use this). Returns
 * `{ok: false}` rather than throwing when `RESEND_API_KEY` is unset, so
 * callers can degrade honestly (see the Stripe webhook's usage) instead
 * of crashing or silently doing nothing.
 */
export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not set" };

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      reply_to: input.replyTo,
    }),
  });

  if (!response.ok) {
    return {
      ok: false,
      error: `Resend API error ${response.status}: ${await response.text()}`,
    };
  }
  return { ok: true };
}
