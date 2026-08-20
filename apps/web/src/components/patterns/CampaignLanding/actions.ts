"use server";

import { headers } from "next/headers";
import { sendEmail } from "@/lib/email";

export interface FreeTrialSignupState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"email", string>>;
}

export const initialFreeTrialSignupState: FreeTrialSignupState = {
  status: "idle",
};

// Same best-effort, single-instance, in-memory rate limiting as
// ContactForm/actions.ts and the shop's checkout action — same documented
// caveat (resets on restart, not correct across multiple serverless
// instances under real traffic; swap in a shared store, e.g. Upstash
// Redis, if/when that becomes a real problem). Kept as its own map rather
// than sharing ContactForm's: a QR landing page and the contact form are
// different abuse surfaces with different expected volumes.
const submissionsByIp = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 8;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (submissionsByIp.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  recent.push(now);
  submissionsByIp.set(ip, recent);
  return recent.length > RATE_LIMIT_MAX;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Captures a parent's email for the free-30-night trial and notifies a
 * human inbox — it does **not** provision an actual trial (create an
 * account, grant audiobook access, or send the first story). No such
 * system exists anywhere in this codebase yet (no customer accounts, no
 * content-delivery/CRM integration — see CLAUDE.md), and inventing one
 * here would be exactly the kind of fabricated production behaviour this
 * session's brief says to stop short of. This is the genuine unresolved
 * dependency: a real trial needs that system built (and a decision on
 * what "free for 30 days" actually delivers technically) before this
 * action can do more than notify someone to follow up by hand.
 *
 * Inert-until-configured, same contract as ContactForm/actions.ts and the
 * Stripe webhook: unset `RESEND_API_KEY`/`FREE_TRIAL_TO_EMAIL` means the
 * page still works end-to-end (validation, honeypot, rate limiting) but
 * the submission is rejected with an honest message instead of silently
 * vanishing or falsely claiming a trial has started.
 */
export async function submitFreeTrialSignup(
  _prevState: FreeTrialSignupState,
  formData: FormData,
): Promise<FreeTrialSignupState> {
  // Honeypot — see ContactForm/actions.ts for the same pattern/rationale.
  if (formData.get("company")) {
    return {
      status: "success",
      message: "You're on the list — we'll be in touch.",
    };
  }

  const email = String(formData.get("email") || "").trim();
  const campaign = String(formData.get("campaign") || "").trim() || "unknown";
  const source = String(formData.get("source") || "").trim();

  if (!email || !isValidEmail(email)) {
    return {
      status: "error",
      fieldErrors: { email: "Enter a valid email address." },
      message: "Please fix the errors below.",
    };
  }

  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  if (isRateLimited(ip)) {
    return {
      status: "error",
      message: "Too many submissions — please try again in a few minutes.",
    };
  }

  const toEmail = process.env.FREE_TRIAL_TO_EMAIL;
  // Reuses the contact form's verified Resend "from" identity — same
  // sending domain, no reason to configure a second one just for this.
  const fromEmail = process.env.CONTACT_FORM_FROM_EMAIL;

  if (!toEmail || !fromEmail) {
    console.warn(
      "Free trial signup submitted but notification isn't configured " +
        "(FREE_TRIAL_TO_EMAIL / CONTACT_FORM_FROM_EMAIL) — see .env.example. " +
        `Lead was NOT recorded anywhere: ${email} (campaign=${campaign}, source=${source || "none"}).`,
    );
    return {
      status: "error",
      message:
        "Sign-ups aren't fully connected yet — please try again shortly, or reach us via the contact page.",
    };
  }

  const result = await sendEmail({
    to: toEmail,
    from: fromEmail,
    replyTo: email,
    subject: `Free trial sign-up — ${campaign}${source ? ` / ${source}` : ""}`,
    text: `New free-30-night-trial sign-up.\n\nEmail: ${email}\nCampaign: ${campaign}\nSource: ${source || "(none)"}\n`,
  });

  if (!result.ok) {
    console.error("Free trial signup notification failed:", result.error);
    return {
      status: "error",
      message: "Something went wrong — please try again.",
    };
  }

  return {
    status: "success",
    message:
      "You're on the list! We'll be in touch to get tonight's story ready.",
  };
}
