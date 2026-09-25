import { getAdminOverview } from "@/lib/admin/overview";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  const result = await getAdminOverview();
  const headers = {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
  };
  if (result.status !== "ready")
    return Response.json(
      {
        error:
          result.status === "denied" ? "Access denied" : "Console unavailable",
      },
      { status: result.status === "denied" ? 403 : 503, headers },
    );
  return Response.json(result, { headers });
}
