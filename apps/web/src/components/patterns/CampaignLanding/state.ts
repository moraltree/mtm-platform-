import type { RegistrationFieldErrors } from "@/lib/registration/validate";
import type { RegistrationConsentErrors } from "@/lib/registrationConsent";

// Deliberately NOT in actions.ts: a "use server" file may only export
// async functions (Next.js build/runtime rule) — a plain object export
// alongside the server action throws "A 'use server' file can only
// export async functions, found object" the first time the action is
// actually invoked (confirmed live, both `next dev` and a production
// `next build && next start` — the build itself succeeds either way,
// which is why this shipped unnoticed and broke every submission on
// `/free30` and every `/start/[storyWorld]/[campaign]` route). This was
// previously exported from actions.ts itself — a real bug, not the
// build-time-only "Server Component import" issue the old comment in
// `start/[storyWorld]/[campaign]/page.tsx` described; see that file's
// updated comment.
// `FreeTrialSignupState`/`initialFreeTrialSignupState` live here so both
// CampaignLanding/actions.ts and start/[storyWorld]/[campaign]/actions.ts
// (the two real server actions that return this shape) and every
// consuming component/test can share one definition without either
// "use server" module illegally exporting the plain value.

export interface FreeTrialSignupState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: RegistrationFieldErrors;
  consentErrors?: RegistrationConsentErrors;
}

export const initialFreeTrialSignupState: FreeTrialSignupState = {
  status: "idle",
};
