import { Cap } from "@/lib/caps";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { rotateSecret } from "@/lib/webhooks/webhooks";
import { NextResponse } from "next/server";

/** Replace the signing secret; the new one is returned once. */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const secret = await rotateSecret(await requireSiteId(), (await ctx.params).id);
  return secret ? NextResponse.json({ secret }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
