import "server-only";
import { authorizeAdmin } from "./auth";
import { readOverviewIn, withSnapshot, type Overview } from "./overview";
import type { AdminRole } from "./policy";
import { intelPresentSql } from "./intel/queries";
import {
  coverageStarts,
  loadAudience,
  loadCampaigns,
  loadCohorts,
  loadCoverage,
  loadListening,
  loadRevenue,
  loadSubscribers,
  type AudienceIntel,
  type CampaignIntel,
  type CohortIntel,
  type CoverageIntel,
  type ListeningIntel,
  type RevenueIntel,
  type SubscriberIntel,
} from "./intel/load";
import type { PeriodId } from "./intel/periods";
import type { ViewId } from "@/app/admin/views";

/** Everything a console view may render. Each view loads only what it needs. */
export interface ConsoleData {
  overview: Overview | null;
  /** False when migration 003 is not installed: Phase 4 sections say so. */
  intelInstalled: boolean;
  subscribers?: SubscriberIntel;
  revenue?: RevenueIntel;
  cohorts?: CohortIntel;
  campaigns?: CampaignIntel;
  audience?: AudienceIntel;
  listening?: ListeningIntel;
  coverage?: CoverageIntel;
}

/** Which sections each view reads. Keeps every page to a bounded set of queries. */
export const VIEW_SECTIONS: Record<
  ViewId,
  (keyof Omit<ConsoleData, "intelInstalled">)[]
> = {
  overview: ["overview", "coverage"],
  growth: ["overview", "subscribers"],
  cohorts: ["cohorts"],
  finance: ["overview", "revenue"],
  funnel: ["campaigns", "listening"],
  campaigns: ["campaigns", "listening"],
  audience: ["audience"],
  listening: ["listening"],
  operations: ["overview", "coverage"],
  activity: ["overview"],
  coverage: ["coverage", "listening"],
};

export async function readConsole(
  view: ViewId,
  period: PeriodId,
  options: { campaign?: string | null; now?: Date } = {},
): Promise<ConsoleData> {
  const now = options.now ?? new Date();
  return withSnapshot(async (db) => {
    const wants = new Set(VIEW_SECTIONS[view]);
    const data: ConsoleData = { overview: null, intelInstalled: false };
    if (wants.has("overview")) data.overview = await readOverviewIn(db, now);
    const present = (await db.query(intelPresentSql)).rows[0]?.present === true;
    data.intelInstalled = present;
    if (!present) return data;
    const starts = await coverageStarts(db);
    if (wants.has("subscribers"))
      data.subscribers = await loadSubscribers(db, now, period, starts);
    if (wants.has("revenue"))
      data.revenue = await loadRevenue(db, now, period, starts);
    if (wants.has("cohorts")) data.cohorts = await loadCohorts(db, now, starts);
    if (wants.has("campaigns"))
      data.campaigns = await loadCampaigns(db, now, period, options.campaign);
    if (wants.has("audience"))
      data.audience = await loadAudience(db, now, period);
    if (wants.has("listening"))
      data.listening = await loadListening(db, now, period, starts);
    if (wants.has("coverage"))
      data.coverage = await loadCoverage(db, now, starts);
    return data;
  });
}

export type ConsoleResult =
  | { status: "denied" }
  | { status: "unavailable" }
  | { status: "ready"; role: AdminRole; asOf: string; data: ConsoleData };

/** Authorizes first, on every request, before any query or parameter use. */
export async function getConsole(
  view: ViewId,
  period: PeriodId,
  campaign?: string | null,
): Promise<ConsoleResult> {
  try {
    const admin = await authorizeAdmin();
    if (!admin) return { status: "denied" };
    const now = new Date();
    return {
      status: "ready",
      role: admin.role,
      asOf: now.toISOString(),
      data: await readConsole(view, period, { campaign, now }),
    };
  } catch {
    // Never serialize/log provider errors, connection strings or account data.
    return { status: "unavailable" };
  }
}
