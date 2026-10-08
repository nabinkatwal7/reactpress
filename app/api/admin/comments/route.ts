import { Cap } from "@/lib/caps";
import { listComments } from "@/lib/comments";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { commentStatusSchema } from "@/lib/validations/comment";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const gate = await requireApiAdmin(Cap.moderateComments);
  if (isApiError(gate)) return gate.error;

  const param = new URL(request.url).searchParams.get("status");
  const status = param ? commentStatusSchema.safeParse(param) : null;
  if (param && !status?.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const comments = await listComments(await requireSiteId(), status?.data);
  return NextResponse.json({ comments });
}
