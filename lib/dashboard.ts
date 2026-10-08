import { prisma } from "@/lib/prisma";

/** Everything the dashboard shows, in one round trip per widget. */
export async function getDashboardData(siteId: string) {
  const [posts, pages, media, comments, recentPublished, recentComments, recentDrafts] =
    await Promise.all([
      prisma.post.groupBy({ by: ["status"], where: { siteId, type: "post" }, _count: true }),
      prisma.page.groupBy({ by: ["status"], where: { siteId }, _count: true }),
      prisma.media.count({ where: { siteId } }),
      prisma.comment.groupBy({ by: ["status"], where: { siteId }, _count: true }),
      prisma.post.findMany({
        where: { siteId, type: "post", status: "publish" },
        orderBy: { publishedAt: "desc" },
        take: 5,
        select: { id: true, title: true, publishedAt: true },
      }),
      prisma.comment.findMany({
        where: { siteId, status: { in: ["pending", "approved"] } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          authorName: true,
          content: true,
          status: true,
          createdAt: true,
          post: { select: { id: true, title: true } },
        },
      }),
      prisma.post.findMany({
        where: { siteId, type: "post", status: "draft" },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, title: true, updatedAt: true },
      }),
    ]);

  const count = (rows: { status: string; _count: number }[], status: string) =>
    rows.find((r) => r.status === status)?._count ?? 0;

  return {
    counts: {
      posts: count(posts, "publish"),
      drafts: count(posts, "draft"),
      scheduled: count(posts, "scheduled"),
      pages: count(pages, "publish"),
      media,
      comments: count(comments, "approved"),
      pendingComments: count(comments, "pending"),
    },
    recentPublished,
    recentComments,
    recentDrafts,
  };
}
