import type { CommentStatus } from "@prisma/client";
import { Cap, can } from "@/lib/caps";
import { prisma } from "@/lib/prisma";
import { withSiteId } from "@/lib/site";
import type { SubmitCommentInput } from "@/lib/validations/comment";

export class CommentError extends Error {}

// ponytail: in-memory per-process limiter; swap for a shared store when running multiple instances
const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

export function rateLimited(key: string, now = Date.now()) {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

const LINK_RE = /https?:\/\//gi;

/** Public submission. Returns the stored comment, or null if silently dropped (honeypot). */
export async function submitComment(
  siteId: string,
  input: SubmitCommentInput,
  meta: { userId?: string | null; ip?: string | null; userAgent?: string | null },
) {
  if (input.website) return null;

  const post = await prisma.post.findFirst({
    where: withSiteId(siteId, { id: input.postId, status: "publish" as const }),
    select: { id: true },
  });
  if (!post) throw new CommentError("Post not found");

  if (input.parentId) {
    const parent = await prisma.comment.findFirst({
      where: { id: input.parentId, postId: post.id, status: "approved" },
      select: { id: true },
    });
    if (!parent) throw new CommentError("Parent comment not found");
  }

  const trusted = meta.userId ? await can(meta.userId, Cap.moderateComments, siteId) : false;
  const linkCount = input.content.match(LINK_RE)?.length ?? 0;
  const status: CommentStatus = trusted ? "approved" : linkCount > 2 ? "spam" : "pending";

  return prisma.comment.create({
    data: {
      siteId,
      postId: post.id,
      parentId: input.parentId ?? null,
      userId: meta.userId ?? null,
      authorName: input.authorName,
      authorEmail: input.authorEmail,
      content: input.content,
      status,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
    },
  });
}

export async function listApprovedComments(siteId: string, postId: string) {
  return prisma.comment.findMany({
    where: withSiteId(siteId, { postId, status: "approved" as const }),
    orderBy: { createdAt: "asc" },
    select: { id: true, parentId: true, authorName: true, content: true, createdAt: true },
  });
}

export async function listComments(siteId: string, status?: CommentStatus) {
  return prisma.comment.findMany({
    where: withSiteId(siteId, status ? { status } : { status: { not: "trash" as const } }),
    orderBy: { createdAt: "desc" },
    include: { post: { select: { id: true, title: true, slug: true } } },
  });
}

export async function commentCounts(siteId: string) {
  const rows = await prisma.comment.groupBy({
    by: ["status"],
    where: { siteId },
    _count: true,
  });
  return Object.fromEntries(rows.map((r) => [r.status, r._count])) as Partial<
    Record<CommentStatus, number>
  >;
}

export async function setCommentStatus(siteId: string, id: string, status: CommentStatus) {
  const res = await prisma.comment.updateMany({
    where: withSiteId(siteId, { id }),
    data: { status },
  });
  return res.count > 0;
}

export async function deleteComment(siteId: string, id: string) {
  const res = await prisma.comment.deleteMany({ where: withSiteId(siteId, { id }) });
  return res.count > 0;
}
