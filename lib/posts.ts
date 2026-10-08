import type { Post, PostStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createRevision } from "@/lib/revisions";
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

export async function listPosts(siteId: string, opts?: { status?: PostStatus }) {
  return prisma.post.findMany({
    where: withSiteId(siteId, opts?.status ? { status: opts.status } : {}),
    orderBy: { updatedAt: "desc" },
    include: { author: { select: { id: true, name: true, email: true } } },
  });
}

export async function getPost(siteId: string, id: string) {
  return prisma.post.findFirst({
    where: withSiteId(siteId, { id }),
    include: { author: { select: { id: true, name: true, email: true } } },
  });
}

export async function createPost(
  siteId: string,
  authorId: string,
  input: CreatePostInput,
): Promise<Post> {
  const slug = await uniqueSlug(siteId, input.slug ?? input.title);
  const status = input.status ?? "draft";

  const created = await prisma.post.create({
    data: {
      siteId,
      authorId,
      title: input.title,
      slug,
      status,
      content: (input.content ?? []) as Prisma.InputJsonValue,
      publishedAt: status === "publish" ? new Date() : null,
    },
  });
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
