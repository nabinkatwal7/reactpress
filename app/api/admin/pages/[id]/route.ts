import { Cap } from "@/lib/caps";
import { deletePage, getPage, updatePage } from "@/lib/pages";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { updatePageSchema } from "@/lib/validations/page";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.editPages);
  if (isApiError(gate)) return gate.error;

  const { id } = await ctx.params;
  const siteId = await requireSiteId();
  const page = await getPage(siteId, id);
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ page });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.editPages);
  if (isApiError(gate)) return gate.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updatePageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  if (parsed.data.status === "publish") {
    const canPublish = await requireApiAdmin(Cap.publishPosts);
    if (isApiError(canPublish)) return canPublish.error;
  }

  const { id } = await ctx.params;
  const siteId = await requireSiteId();
  const page = await updatePage(siteId, id, parsed.data);
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ page });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.editPages);
  if (isApiError(gate)) return gate.error;

  const { id } = await ctx.params;
  const siteId = await requireSiteId();
  const ok = await deletePage(siteId, id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
