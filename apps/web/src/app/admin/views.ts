/** Allowlisted console views, grouped for navigation. Anything else renders the overview. */
export const VIEWS = [
  { id: "overview", label: "Overview", group: "Business" },
  { id: "growth", label: "Subscribers", group: "Business" },
  { id: "cohorts", label: "Cohorts", group: "Business" },
  { id: "finance", label: "Revenue", group: "Business" },
  { id: "funnel", label: "Funnel", group: "Growth" },
  { id: "campaigns", label: "Campaigns", group: "Growth" },
  { id: "audience", label: "Audience", group: "Growth" },
  { id: "listening", label: "Listening", group: "Product" },
  { id: "operations", label: "Operations", group: "System" },
  { id: "activity", label: "Activity", group: "System" },
  { id: "coverage", label: "Data coverage", group: "System" },
] as const;
export type ViewId = (typeof VIEWS)[number]["id"];
export const NAV_GROUPS = ["Business", "Growth", "Product", "System"] as const;

/** Views with a period selector (server-side, allowlisted). */
export const PERIOD_VIEWS: readonly ViewId[] = [
  "growth",
  "finance",
  "funnel",
  "campaigns",
  "audience",
  "listening",
];

/** Phase 3 bookmarks keep working. */
const ALIASES: Record<string, ViewId> = { roadmap: "coverage" };

export function parseView(value: unknown): ViewId {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate === "string" && Object.hasOwn(ALIASES, candidate))
    return ALIASES[candidate];
  return VIEWS.find((v) => v.id === candidate)?.id ?? "overview";
}
