import { parseBody } from "@/lib/api-json";
import { Cap } from "@/lib/caps";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { deleteWebhook, updateWebhook } from "@/lib/webhooks/webhooks";
import { NextResponse } from "next/server";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().max(100).optional(),
  url: z.string().min(1).optional(),
  events: z.array(z.string()).min(1).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const body = await parseBody(request, patchSchema);
  if ("error" in body) return body.error;
  try {
    const webhook = await updateWebhook(await requireSiteId(), (await ctx.params).id, body.data);
    return webhook ? NextResponse.json({ webhook }) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  if (!(await deleteWebhook(await requireSiteId(), (await ctx.params).id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
