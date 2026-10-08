import type { Post, PostStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { syncPublishJob } from "@/lib/jobs";
import { createRevision } from "@/lib/revisions";
import { setPostTerms } from "@/lib/terms";
import { getPostType } from "@/lib/registry";
import { slugify } from "@/lib/slug";
import { withSiteId } from "@/lib/site";
import type { CreatePostInput, UpdatePostInput } from "@/lib/validations/post";

async function uniqueSlug(siteId: string, base: string, excludeId?: string): Promise<string> {
  let slug = slugify(base);
  let n = 2;
  for (;;) {
    const existing = await prisma.post.findFirst({
      where: {
        ...withSiteId(siteId, { slug }),
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return slug;
    slug = `${slugify(base)}-${n}`;
    n += 1;
  }
}

export async function listPosts(siteId: string, opts?: { type?: string; status?: PostStatus; taxonomy?: string; term?: string }) {
  return prisma.post.findMany({
    where: withSiteId(siteId, {
      type: opts?.type ?? "post",
      ...(opts?.status ? { status: opts.status } : {}),
      ...(opts?.term
        ? {
            terms: {
              some: {
                term: {
                  slug: opts.term,
                  ...(opts.taxonomy ? { taxonomy: opts.taxonomy } : {}),
                },
              },
            },
          }
        : {}),
    }),
    orderBy: { updatedAt: "desc" },
    include: {
      author: { select: { id: true, name: true, email: true } },
      terms: { include: { term: true } },
    },
  });
}

export async function getPost(siteId: string, id: string) {
  return prisma.post.findFirst({
    where: withSiteId(siteId, { id }),
    include: {
      author: { select: { id: true, name: true, email: true } },
      terms: { include: { term: true } },
    },
  });
}

export async function createPost(
  siteId: string,
  authorId: string,
  input: CreatePostInput,
): Promise<Post> {
  const type = input.type ?? "post";
  if (!(await getPostType(siteId, type))) throw new Error("Unknown post type");
  const slug = await uniqueSlug(siteId, input.slug ?? input.title);
  const status = input.status ?? "draft";

  const created = await prisma.post.create({
    data: {
      siteId,
      authorId,
      type,
      title: input.title,
      slug,
      status,
      content: (input.content ?? []) as Prisma.InputJsonValue,
      publishedAt: status === "publish" ? new Date() : null,
      scheduledAt: status === "scheduled" ? new Date(input.scheduledAt!) : null,
    },
  });
  if (input.termIds?.length) await setPostTerms(siteId, created.id, input.termIds);
  await syncPublishJob(siteId, "post", created.id, created.status, created.scheduledAt);
  await createRevision(siteId, "post", created.id, authorId, {
    title: created.title,
    content: created.content,
  });
  return created;
}

export async function updatePost(
  siteId: string,
  id: string,
  input: UpdatePostInput,
): Promise<Post | null> {
  const existing = await getPost(siteId, id);
  if (!existing) return null;

  const data: Prisma.PostUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.status !== undefined) {
    data.status = input.status;
    if (input.status === "publish" && !existing.publishedAt) {
      data.publishedAt = new Date();
    }
    data.scheduledAt =
      input.status === "scheduled" && input.scheduledAt ? new Date(input.scheduledAt) : null;
  } else if (input.scheduledAt !== undefined && existing.status === "scheduled" && input.scheduledAt) {
    data.scheduledAt = new Date(input.scheduledAt);
  }
  if (input.content !== undefined) {
    data.content = input.content as Prisma.InputJsonValue;
  }
  if (input.slug !== undefined) {
    data.slug = await uniqueSlug(siteId, input.slug, id);
  } else if (input.title !== undefined && input.title !== existing.title) {
    // keep slug unless explicitly changed — ponytail: no auto-rename on edit
  }

  const updated = await prisma.post.update({
    where: { id },
    data,
  });
  if (input.termIds) await setPostTerms(siteId, id, input.termIds);
  await syncPublishJob(siteId, "post", id, updated.status, updated.scheduledAt);
  if (input.title !== undefined || input.content !== undefined) {
    await createRevision(siteId, "post", id, existing.authorId, {
      title: updated.title,
      content: updated.content,
    });
  }
  return updated;
}

export async function deletePost(siteId: string, id: string): Promise<boolean> {
  const existing = await getPost(siteId, id);
  if (!existing) return false;
  await prisma.post.delete({ where: { id } });
  return true;
}
