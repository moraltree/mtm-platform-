import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { database, transaction, recordEvent, type Account } from "./db";
import { enabled, origin, trialOptions } from "./config";
import { trialDays } from "./policy";
import { beginTrial } from "./trials";
import { isValidEmail, sendEmail } from "../email";
import type { StartTrialRequest, StartTrialResult } from "../platform/contract";

export const sessionCookie = "mtm_member_session";
export const hashToken = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export async function currentAccount(): Promise<Account | null> {
  if (!enabled()) return null;
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const result = await database().query<Account>(
    `SELECT a.* FROM mtm_accounts a JOIN mtm_sessions s ON s.user_id=a.id
     WHERE s.token_hash=$1 AND s.expires_at>now()`,
    [hashToken(token)],
  );
  return result.rows[0] ?? null;
}

export async function requireAccount() {
  const account = await currentAccount();
  if (!account || account.blocked) throw new Error("Sign in required");
  return account;
}

/** Verified mailbox is the identity boundary. No account/trial on unverified signup. */
export async function requestLogin(
  emailInput: string,
  registration?: StartTrialRequest,
): Promise<void> {
  const email = emailInput.trim().toLowerCase();
  if (!isValidEmail(email) || email.length > 254)
    throw new Error("Invalid email");
  if (!process.env.RESEND_API_KEY || !process.env.CONTACT_FORM_FROM_EMAIL)
    throw new Error("Email sign-in is not configured");
  const token = randomBytes(32).toString("hex");
  const allowed = await transaction(async (db) => {
    // Cross-instance rate limit; serialize by normalized email without storing fingerprints.
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [email]);
    const recent = await db.query(
      "SELECT 1 FROM mtm_login_tokens WHERE email=$1 AND created_at>now()-interval '1 minute'",
      [email],
    );
    if (recent.rowCount) return false;
    if (!registration) {
      const known = await db.query(
        "SELECT 1 FROM mtm_accounts WHERE email=$1",
        [email],
      );
      if (!known.rowCount) return false;
    }
    if (registration) {
      trialDays(
        registration.offer?.trialLengthDays ??
          process.env.DEFAULT_TRIAL_DAYS ??
          "30",
      );
    }
    await db.query(
      "INSERT INTO mtm_login_tokens(token_hash,email,registration,expires_at) VALUES($1,$2,$3,now()+interval '15 minutes')",
      [
        hashToken(token),
        email,
        registration
          ? JSON.stringify({
              request: registration,
              options: trialOptions(),
              days: trialDays(
                registration.offer?.trialLengthDays ??
                  process.env.DEFAULT_TRIAL_DAYS ??
                  "30",
              ),
            })
          : null,
      ],
    );
    return true;
  });
  if (!allowed) return;
  const result = await sendEmail({
    to: email,
    from: process.env.CONTACT_FORM_FROM_EMAIL,
    subject: "Sign in to Moral Tree Media",
    text: `Confirm your email to continue. This link expires in 15 minutes.\n\n${origin()}/subscribe/verify#${token}\n\nIf you did not request this, ignore this email.`,
  });
  if (!result.ok) {
    await database().query("DELETE FROM mtm_login_tokens WHERE token_hash=$1", [
      hashToken(token),
    ]);
    throw new Error("Unable to send sign-in email");
  }
}

export async function consumeLogin(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Invalid sign-in link");
  const session = randomBytes(32).toString("hex");
  await transaction(async (db) => {
    const result = await db.query(
      "DELETE FROM mtm_login_tokens WHERE token_hash=$1 AND expires_at>now() RETURNING *",
      [hashToken(token)],
    );
    const login = result.rows[0];
    if (!login) throw new Error("Sign-in link has expired or was already used");
    if (login.registration) {
      const { request, options, days } = login.registration;
      await db.query(
        `INSERT INTO mtm_accounts(id,email,registration,trial_days,card_required,auto_convert)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(email) DO NOTHING`,
        [
          randomUUID(),
          login.email,
          JSON.stringify(request),
          days,
          options.cardRequired,
          options.autoConvert,
        ],
      );
    }
    const account = (
      await db.query<Account>(
        "SELECT * FROM mtm_accounts WHERE email=$1 FOR UPDATE",
        [login.email],
      )
    ).rows[0];
    if (!account || account.blocked) throw new Error("Account unavailable");
    await recordEvent(
      db,
      account.id,
      `trial-offered:${account.id}`,
      "TRIAL_OFFERED",
      { days: account.trial_days },
    );
    if (!account.card_required) await beginTrial(db, account);
    await db.query(
      "INSERT INTO mtm_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
      [hashToken(session), account.id],
    );
  });
  (await cookies()).set(sessionCookie, session, {
    httpOnly: true,
    secure: origin().startsWith("https:"),
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 86400,
  });
}

export async function subscriptionRegistration(
  request: StartTrialRequest,
): Promise<StartTrialResult> {
  try {
    await requestLogin(request.adult.email, request);
    return {
      status: "pending-email-verification",
      message:
        "Check your email to verify your address and continue. Access starts only after verification and any required card setup.",
    };
  } catch {
    return {
      status: "error",
      message: "Account setup is unavailable. Please try again shortly.",
    };
  }
}
