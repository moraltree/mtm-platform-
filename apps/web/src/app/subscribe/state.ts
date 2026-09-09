/**
 * Not in actions.ts — a "use server" file may only export async
 * functions (same lesson as CampaignLanding/state.ts; see that file's
 * own doc comment). This plain module is safe to import from both the
 * Server Action and the Client Component that renders the form.
 */

export interface SubscribeCheckoutState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"email" | "plan" | "firstName" | "lastName", string>>;
}

export const initialSubscribeCheckoutState: SubscribeCheckoutState = {
  status: "idle",
};
