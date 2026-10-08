import type { PostStatus, Prisma } from "@prisma/client";
import { Cap, can } from "@/lib/caps";
import { prisma } from "@/lib/prisma";
import { emitFor } from "@/lib/webhooks/webhooks";

export type ContentKind = "post" | "page";

export const PER_PAGE = 20;

export type ListQuery = {
  type?: string;
  status?: PostStatus;
  q?: string;
  taxonomy?: string;
  term?: string;
  page?: number;
};

const author = { select: { id: true, name: true, email: true } } as const;

function common(siteId: string, q: ListQuery) {
  const search = q.q?.trim();
  return {
    siteId,
    // "All" hides trash, like WordPress; ask for status=trash explicitly
    status: q.status ?? { not: "trash" as const },
    ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}),
  };
}

function skip(q: ListQuery) {
  return (Math.max(q.page ?? 1, 1) - 1) * PER_PAGE;
}

export async function queryPosts(siteId: string, q: ListQuery = {}) {
  const where: Prisma.PostWhereInput = {
    ...common(siteId, q),
    type: q.type ?? "post",
    ...(q.term
      ? {
          terms: {
            some: { term: { slug: q.term, ...(q.taxonomy ? { taxonomy: q.taxonomy } : {}) } },
          },
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: skip(q),
      take: PER_PAGE,
      include: { author, terms: { include: { term: true } } },
    }),
    prisma.post.count({ where }),
  ]);
  return { items, total, pages: Math.max(Math.ceil(total / PER_PAGE), 1) };
}

export async function queryPages(siteId: string, q: ListQuery = {}) {
  const where: Prisma.PageWhereInput = common(siteId, q);
  const [items, total] = await Promise.all([
    prisma.page.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: skip(q),
      take: PER_PAGE,
      include: { author, parent: { select: { id: true, title: true } } },
    }),
    prisma.page.count({ where }),
  ]);
  return { items, total, pages: Math.max(Math.ceil(total / PER_PAGE), 1) };
}

/** Counts per status for the filter tabs. */
export async function statusCounts(siteId: string, kind: ContentKind, type = "post") {
  const rows =
    kind === "post"
      ? await prisma.post.groupBy({ by: ["status"], where: { siteId, type }, _count: true })
      : await prisma.page.groupBy({ by: ["status"], where: { siteId }, _count: true });
  return Object.fromEntries(rows.map((r) => [r.status, r._count])) as Partial<Record<PostStatus, number>>;
}

export const BULK_ACTIONS = ["publish", "draft", "trash", "restore", "delete"] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];

/** Which capability a bulk action needs ("publish" is gated separately from plain edits). */
export function bulkNeedsPublish(action: BulkAction) {
  return action === "publish";
}

/**
 * Apply one action to many items of this site. Returns how many rows changed.
 * `delete` only removes items already in the trash.
 */
export async function bulkUpdate(
  siteId: string,
  kind: ContentKind,
  ids: string[],
  action: BulkAction,
): Promise<number> {
  if (ids.length === 0) return 0;
  const base = { siteId, id: { in: ids } };
  const delegate = kind === "post" ? prisma.post : prisma.page;
  // both delegates share these fields; the cast keeps one code path
  const model = delegate as typeof prisma.post;
  // what each row was before, so webhooks can say what changed
  const prior = await model.findMany({ where: base });

  if (action === "delete") {
    const res = await model.deleteMany({ where: { ...base, status: "trash" } });
    for (const row of prior.filter((r) => r.status === "trash")) await emitFor(siteId, kind, "deleted", row);
    return res.count;
  }

  const status: PostStatus = action === "publish" ? "publish" : action === "trash" ? "trash" : "draft";
  let count = 0;
  if (action === "publish") {
    // keep the original publish date when re-publishing
    const now = new Date();
    // rows that already have a date first, so the second pass cannot re-match them
    const rest = await model.updateMany({
      where: { ...base, publishedAt: { not: null } },
      data: { status, scheduledAt: null },
    });
    const first = await model.updateMany({
      where: { ...base, publishedAt: null },
      data: { status, scheduledAt: null, publishedAt: now },
    });
    count = first.count + rest.count;
  } else {
    const res = await model.updateMany({
      where: base,
      data: { status, scheduledAt: null },
    });
    count = res.count;
  }

  // anything that was scheduled no longer should publish itself
  await prisma.job.deleteMany({
    where: {
      siteId,
      type: "publish",
      status: "pending",
      OR: ids.map((id) => ({ payload: { path: ["entityId"], equals: id } })),
    },
  });
  for (const row of prior) {
    await emitFor(siteId, kind, "updated", { ...row, status });
    if (status === "publish" && row.status !== "publish") await emitFor(siteId, kind, "published", { ...row, status });
  }
  return count;
}

/** Capability-checked entry point for bulk actions (shared by server actions and the API). */
export async function runBulk(
  userId: string,
  siteId: string,
  kind: ContentKind,
  ids: string[],
  action: string,
): Promise<{ error: string } | { count: number }> {
  if (!(BULK_ACTIONS as readonly string[]).includes(action)) return { error: "Unknown action" };
  const act = action as BulkAction;
  if (!(await can(userId, kind === "post" ? Cap.editPosts : Cap.editPages, siteId))) {
    return { error: "Not allowed" };
  }
  if (bulkNeedsPublish(act) && !(await can(userId, Cap.publishPosts, siteId))) {
    return { error: "Missing publish_posts capability" };
  }
  return { count: await bulkUpdate(siteId, kind, ids.slice(0, 200), act) };
}
