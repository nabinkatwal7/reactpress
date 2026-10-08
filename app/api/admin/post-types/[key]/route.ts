import { parseBody } from "@/lib/api-json";
import { Cap } from "@/lib/caps";
import { deletePostType, updatePostType } from "@/lib/registry";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { updatePostTypeSchema } from "@/lib/validations/registry";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ key: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const body = await parseBody(request, updatePostTypeSchema);
  if ("error" in body) return body.error;

  const { key } = await ctx.params;
  const postType = await updatePostType(await requireSiteId(), key, body.data);
  if (!postType) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ postType });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const { key } = await ctx.params;
  try {
    const ok = await deletePostType(await requireSiteId(), key);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
