import { Cap } from "@/lib/caps";
import { createPage, listPages } from "@/lib/pages";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { createPageSchema, pageStatusSchema } from "@/lib/validations/page";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const gate = await requireApiAdmin(Cap.editPages);
  if (isApiError(gate)) return gate.error;

  const siteId = await requireSiteId();
  const statusParam = new URL(request.url).searchParams.get("status");
  const status = statusParam
    ? pageStatusSchema.safeParse(statusParam)
    : null;

  if (statusParam && !status?.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const pages = await listPages(siteId, {
    status: status?.success ? status.data : undefined,
  });
  return NextResponse.json({ pages });
}

export async function POST(request: Request) {
  const gate = await requireApiAdmin(Cap.editPages);
  if (isApiError(gate)) return gate.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createPageSchema.safeParse(body);
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

  const siteId = await requireSiteId();
  const page = await createPage(siteId, gate.userId, parsed.data);
  return NextResponse.json({ page }, { status: 201 });
}
