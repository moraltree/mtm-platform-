"use server";

import { headers } from "next/headers";

export interface ContactFormState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "message", string>>;
}

export const initialContactFormState: ContactFormState = { status: "idle" };

const RESEND_API_URL = "https://api.resend.com/emails";
const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Best-effort, single-instance rate limiting. Resets on restart, and does
// nothing useful across multiple serverless instances — a real deployment
// needs a shared store (Upstash Redis, Vercel KV, etc.) once a hosting
// target is chosen. Kept as a real (if imperfect) backstop rather than
// nothing, alongside the honeypot field below.
const submissionsByIp = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

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

async function verifyTurnstile(
  token: string,
  secret: string,
  ip: string,
): Promise<boolean> {
  if (!token) return false;
  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const data = (await response.json()) as { success?: boolean };
    return data.success === true;
  } catch (error) {
    console.error("Turnstile verification request failed:", error);
    return false;
  }
}

export async function submitContactForm(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  // Honeypot: a field real visitors never see or fill in (hidden
  // off-screen, not `display:none`/`hidden`, since unsophisticated bots
  // often skip those specifically). Any value here means it's a bot —
  // report success without actually doing anything, so it doesn't learn
  // the check exists.
  if (formData.get("company")) {
    return { status: "success", message: "Thanks — we'll be in touch soon." };
  }

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const message = String(formData.get("message") || "").trim();

  const fieldErrors: ContactFormState["fieldErrors"] = {};
  if (!name) fieldErrors.name = "Enter your name.";
  if (!email || !isValidEmail(email))
    fieldErrors.email = "Enter a valid email address.";
  if (!message) fieldErrors.message = "Enter a message.";
  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      fieldErrors,
      message: "Please fix the errors below.",
    };
  }

  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  if (isRateLimited(ip)) {
    return {
      status: "error",
      message: "Too many submissions — please try again later.",
    };
  }

  // Inert until TURNSTILE_SECRET_KEY is set — see .env.example.
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (turnstileSecret) {
    const token = String(formData.get("cf-turnstile-response") || "");
    if (!(await verifyTurnstile(token, turnstileSecret, ip))) {
      return {
        status: "error",
        message: "Verification failed — please try again.",
      };
    }
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_FORM_TO_EMAIL;
  const fromEmail = process.env.CONTACT_FORM_FROM_EMAIL;

  if (!resendApiKey || !toEmail || !fromEmail) {
    console.warn(
      "Contact form submitted but email delivery isn't configured " +
        "(RESEND_API_KEY / CONTACT_FORM_TO_EMAIL / CONTACT_FORM_FROM_EMAIL) — see .env.example.",
    );
    return {
      status: "error",
      message:
        "This form isn't fully set up yet — please email us directly instead.",
    };
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: toEmail,
      reply_to: email,
      subject: `Contact form message from ${name}`,
      text: message,
    }),
  });

  if (!response.ok) {
    console.error("Resend API error:", response.status, await response.text());
    return {
      status: "error",
      message: "Something went wrong sending your message. Please try again.",
    };
  }

  return { status: "success", message: "Thanks — we'll be in touch soon." };
}
