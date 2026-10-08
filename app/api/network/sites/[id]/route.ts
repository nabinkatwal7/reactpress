import { parseBody } from "@/lib/api-json";
import { deleteSite, updateSite } from "@/lib/network/sites";
import { requireApiSuperAdmin } from "@/lib/require-super-admin";
import { siteSchema } from "@/lib/validations/site";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireApiSuperAdmin();
  if ("error" in gate) return gate.error;
  const body = await parseBody(request, siteSchema);
  if ("error" in body) return body.error;
  try {
    return NextResponse.json({ site: await updateSite((await ctx.params).id, body.data) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const gate = await requireApiSuperAdmin();
  if ("error" in gate) return gate.error;
  try {
    if (!(await deleteSite((await ctx.params).id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
