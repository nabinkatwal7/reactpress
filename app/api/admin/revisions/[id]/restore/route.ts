import { Cap, can } from "@/lib/caps";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { getRevision, restoreRevision } from "@/lib/revisions";
import { requireSiteId } from "@/lib/site";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin();
  if (isApiError(gate)) return gate.error;

  const { id } = await ctx.params;
  const siteId = await requireSiteId();
  const rev = await getRevision(siteId, id);
  if (!rev) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cap = rev.entityType === "post" ? Cap.editPosts : Cap.editPages;
  if (!(await can(gate.userId, cap))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await restoreRevision(siteId, id, gate.userId);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, ...result });
}
