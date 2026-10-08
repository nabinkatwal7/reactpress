import { parseBody } from "@/lib/api-json";
import { Cap } from "@/lib/caps";
import { deleteTaxonomy, updateTaxonomy } from "@/lib/registry";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { updateTaxonomySchema } from "@/lib/validations/registry";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ key: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const body = await parseBody(request, updateTaxonomySchema);
  if ("error" in body) return body.error;

  const { key } = await ctx.params;
  const taxonomy = await updateTaxonomy(await requireSiteId(), key, body.data);
  if (!taxonomy) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ taxonomy });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const { key } = await ctx.params;
  try {
    const ok = await deleteTaxonomy(await requireSiteId(), key);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
