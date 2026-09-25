import { currentAccount } from "@/lib/subscriptions/auth";
import { accessFor } from "@/lib/subscriptions/access";
import { database } from "@/lib/subscriptions/db";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const account = await currentAccount();
  if (!account) return new Response(null, { status: 401 });
  const access = await accessFor(account.id);
  if (access === "none") return new Response(null, { status: 403 });
  const { id } = await params;
  const story = (
    await database().query(
      "SELECT id FROM mtm_library WHERE id=$1 AND published=true AND ($2='paid' OR free_selection=true)",
      [id, access],
    )
  ).rows[0];
  if (!story) return new Response(null, { status: 404 });
  const source = process.env.LIBRARY_AUDIO_ORIGIN;
  const key = process.env.LIBRARY_AUDIO_TOKEN;
  if (!source || !key || new URL(source).protocol !== "https:")
    return new Response(null, { status: 503 });
  const upstream = await fetch(
    new URL(`/audio/${encodeURIComponent(id)}`, source),
    {
      headers: {
        Authorization: `Bearer ${key}`,
        ...(request.headers.get("range")
          ? { Range: request.headers.get("range")! }
          : {}),
      },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    },
  );
  if (![200, 206, 416].includes(upstream.status))
    return new Response(null, { status: 502 });
  if (
    upstream.status !== 416 &&
    !upstream.headers.get("content-type")?.toLowerCase().startsWith("audio/")
  ) {
    await upstream.body?.cancel();
    return new Response(null, { status: 502 });
  }
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  for (const name of [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
  ]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.status === 416 ? null : upstream.body, {
    status: upstream.status,
    headers,
  });
}
