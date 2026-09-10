import { currentAccount } from "@/lib/subscriptions/auth";
import { accessFor } from "@/lib/subscriptions/access";
export async function GET() {
  const account = await currentAccount();
  if (!account)
    return Response.json({ error: "Sign in required" }, { status: 401 });
  return Response.json(
    { access: await accessFor(account.id) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
