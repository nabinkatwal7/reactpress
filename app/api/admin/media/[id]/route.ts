import { parseBody } from "@/lib/api-json";
import { Cap } from "@/lib/caps";
import { deleteMedia, getMedia, updateMedia } from "@/lib/media";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { updateMediaSchema } from "@/lib/validations/media";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.uploadFiles);
  if (isApiError(gate)) return gate.error;
  const { id } = await ctx.params;
  const media = await getMedia(await requireSiteId(), id);
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ media });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.uploadFiles);
  if (isApiError(gate)) return gate.error;
  const body = await parseBody(request, updateMediaSchema);
  if ("error" in body) return body.error;

  const { id } = await ctx.params;
  const media = await updateMedia(await requireSiteId(), id, body.data);
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ media });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.uploadFiles);
  if (isApiError(gate)) return gate.error;
  const { id } = await ctx.params;
  const ok = await deleteMedia(await requireSiteId(), id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
