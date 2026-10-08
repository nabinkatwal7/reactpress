import { Cap, can } from "@/lib/caps";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { listRevisions } from "@/lib/revisions";
import { requireSiteId } from "@/lib/site";
import { entityTypeSchema } from "@/lib/validations/revision";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const gate = await requireApiAdmin();
  if (isApiError(gate)) return gate.error;

  const sp = new URL(request.url).searchParams;
  const type = entityTypeSchema.safeParse(sp.get("type"));
  const id = sp.get("id");
  if (!type.success || !id) {
    return NextResponse.json({ error: "type and id required" }, { status: 400 });
  }
  const cap = type.data === "post" ? Cap.editPosts : Cap.editPages;
  if (!(await can(gate.userId, cap))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const revisions = await listRevisions(await requireSiteId(), type.data, id);
  return NextResponse.json({ revisions });
}
