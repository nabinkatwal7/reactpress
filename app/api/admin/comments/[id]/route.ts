import { parseBody } from "@/lib/api-json";
import { Cap } from "@/lib/caps";
import { deleteComment, setCommentStatus } from "@/lib/comments";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { moderateCommentSchema } from "@/lib/validations/comment";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.moderateComments);
  if (isApiError(gate)) return gate.error;
  const body = await parseBody(request, moderateCommentSchema);
  if ("error" in body) return body.error;

  const { id } = await ctx.params;
  const ok = await setCommentStatus(await requireSiteId(), id, body.data.status);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.moderateComments);
  if (isApiError(gate)) return gate.error;
  const { id } = await ctx.params;
  const ok = await deleteComment(await requireSiteId(), id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
