import { Cap } from "@/lib/caps";
import { createPost, listPosts } from "@/lib/posts";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { createPostSchema, postStatusSchema } from "@/lib/validations/post";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const gate = await requireApiAdmin(Cap.editPosts);
  if (isApiError(gate)) return gate.error;

  const siteId = await requireSiteId();
  const statusParam = new URL(request.url).searchParams.get("status");
  const status = statusParam
    ? postStatusSchema.safeParse(statusParam)
    : null;

  if (statusParam && !status?.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const posts = await listPosts(siteId, {
    status: status?.success ? status.data : undefined,
  });
  return NextResponse.json({ posts });
}

export async function POST(request: Request) {
  const gate = await requireApiAdmin(Cap.editPosts);
  if (isApiError(gate)) return gate.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createPostSchema.safeParse(body);
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
  const post = await createPost(siteId, gate.userId, parsed.data);
  return NextResponse.json({ post }, { status: 201 });
}
