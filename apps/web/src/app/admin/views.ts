/** Allowlisted console views. Anything else renders the overview. */
export const VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "growth", label: "Subscribers & conversion" },
  { id: "finance", label: "Finance" },
  { id: "operations", label: "Operations" },
  { id: "activity", label: "Activity" },
  { id: "roadmap", label: "Future analytics" },
] as const;
export type ViewId = (typeof VIEWS)[number]["id"];

export function parseView(value: unknown): ViewId {
  const candidate = Array.isArray(value) ? value[0] : value;
  return VIEWS.find((v) => v.id === candidate)?.id ?? "overview";
}
