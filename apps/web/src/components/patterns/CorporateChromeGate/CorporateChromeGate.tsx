"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isCampaignRoute } from "@/lib/campaignRoutes";

export interface CorporateChromeGateProps {
  children: ReactNode;
}

/**
 * Renders `children` (the corporate `Header`/`Footer`, passed in as
 * already-server-rendered JSX from the root layout — a Server Component)
 * everywhere *except* campaign/QR landing routes (`isCampaignRoute`,
 * lib/campaignRoutes.ts), where it renders nothing.
 *
 * Deliberately a thin client-side gate rather than restructuring routing
 * (e.g. moving every existing route into a route group with its own
 * layout) — `usePathname()` is resolved per static page at
 * render/build time, so this doesn't force any page (campaign or
 * corporate) into dynamic/per-request rendering the way reading
 * `headers()`/cookies in the shared root layout would; every existing
 * route keeps exactly the static-generation behaviour it had before this
 * component existed. `Header`/`Footer` themselves aren't touched — this
 * only decides whether they're rendered at all for the current route.
 */
export function CorporateChromeGate({ children }: CorporateChromeGateProps) {
  const pathname = usePathname();
  if (isCampaignRoute(pathname)) return null;
  return <>{children}</>;
}
