import { parseBody } from "@/lib/api-json";
import { Cap } from "@/lib/caps";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { removeWidget, updateWidget, updateWidgetSchema } from "@/lib/widgets";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const body = await parseBody(request, updateWidgetSchema);
  if ("error" in body) return body.error;
  const { id } = await ctx.params;
  try {
    const widget = await updateWidget(await requireSiteId(), id, body.data.settings);
    if (!widget) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ widget });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const { id } = await ctx.params;
  const ok = await removeWidget(await requireSiteId(), id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
