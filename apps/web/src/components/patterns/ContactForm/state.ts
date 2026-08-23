// Deliberately NOT in actions.ts: a "use server" file may only export
// async functions (Next.js build/runtime rule) — a plain object export
// alongside the server action throws "A 'use server' file can only
// export async functions, found object" the first time the action is
// actually invoked (confirmed live, both `next dev` and a production
// `next build && next start`; the build itself succeeds either way,
// which is why this shipped unnoticed — see actions.ts's own comment).
// `initialContactFormState` lives here so `ContactForm.tsx` can import it
// without pulling a non-function value out of the server-action module.

export interface ContactFormState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "message", string>>;
}

export const initialContactFormState: ContactFormState = { status: "idle" };
