import { parseBody } from "@/lib/api-json";
import { Cap } from "@/lib/caps";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { reorderSchema, reorderWidgets } from "@/lib/widgets";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ key: string }> };

export async function PUT(request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const body = await parseBody(request, reorderSchema);
  if ("error" in body) return body.error;
  const { key } = await ctx.params;
  try {
    await reorderWidgets(await requireSiteId(), key, body.data.ids);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
