import { Cap } from "@/lib/caps";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { testWebhook } from "@/lib/webhooks/webhooks";
import { NextResponse } from "next/server";

/** Send a `ping` now and report the receiver's answer. */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const result = await testWebhook(await requireSiteId(), (await ctx.params).id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ result });
}
