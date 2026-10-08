import { auth } from "@/auth";
import { parseBody } from "@/lib/api-json";
import { CommentError, rateLimited, submitComment } from "@/lib/comments";
import { prisma } from "@/lib/prisma";
import { submitCommentSchema } from "@/lib/validations/comment";
import { NextResponse } from "next/server";

/** Public endpoint: anyone can submit; new comments land in the moderation queue. */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many comments, slow down" }, { status: 429 });
  }

  const body = await parseBody(request, submitCommentSchema);
  if ("error" in body) return body.error;

  // the post decides the site, so the form works under any domain or /site-slug prefix
  const post = await prisma.post.findUnique({ where: { id: body.data.postId }, select: { siteId: true } });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const session = await auth();
  try {
    const comment = await submitComment(post.siteId, body.data, {
      userId: session?.user?.id,
      ip,
      userAgent: request.headers.get("user-agent"),
    });
    // honeypot hits get the same response as success
    return NextResponse.json(
      { ok: true, status: comment?.status ?? "pending" },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof CommentError) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    throw e;
  }
}
