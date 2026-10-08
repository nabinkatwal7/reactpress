import { Cap } from "@/lib/caps";
import { deletePost, getPost, updatePost } from "@/lib/posts";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { updatePostSchema } from "@/lib/validations/post";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.editPosts);
  if (isApiError(gate)) return gate.error;

  const { id } = await ctx.params;
  const siteId = await requireSiteId();
  const post = await getPost(siteId, id);
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ post });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.editPosts);
  if (isApiError(gate)) return gate.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updatePostSchema.safeParse(body);
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
  const post = await updatePost(siteId, id, parsed.data);
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ post });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.editPosts);
  if (isApiError(gate)) return gate.error;

  const { id } = await ctx.params;
  const siteId = await requireSiteId();
  const ok = await deletePost(siteId, id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
