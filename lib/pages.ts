import type { Page, PostStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { withSiteId } from "@/lib/site";
import type { CreatePageInput, UpdatePageInput } from "@/lib/validations/page";

async function uniqueSlug(siteId: string, base: string, excludeId?: string): Promise<string> {
  let slug = slugify(base);
  let n = 2;
  for (;;) {
    const existing = await prisma.page.findFirst({
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

async function checkParent(siteId: string, parentId?: string | null) {
  if (!parentId) return null;
  const parent = await prisma.page.findFirst({
    where: withSiteId(siteId, { id: parentId }),
    select: { id: true },
  });
  if (!parent) throw new Error("Parent page not found");
  return parent.id;
}

export async function listPages(siteId: string, opts?: { status?: PostStatus }) {
  return prisma.page.findMany({
    where: withSiteId(siteId, opts?.status ? { status: opts.status } : {}),
    orderBy: { updatedAt: "desc" },
    include: { author: { select: { id: true, name: true, email: true } } },
  });
}

export async function getPage(siteId: string, id: string) {
  return prisma.page.findFirst({
    where: withSiteId(siteId, { id }),
    include: { author: { select: { id: true, name: true, email: true } } },
  });
}

export async function createPage(
  siteId: string,
  authorId: string,
  input: CreatePageInput,
): Promise<Page> {
  const slug = await uniqueSlug(siteId, input.slug ?? input.title);
  const status = input.status ?? "draft";

  return prisma.page.create({
    data: {
      siteId,
      authorId,
      title: input.title,
      slug,
      status,
      content: (input.content ?? []) as Prisma.InputJsonValue,
      parentId: await checkParent(siteId, input.parentId),
      publishedAt: status === "publish" ? new Date() : null,
    },
  });
}

export async function updatePage(
  siteId: string,
  id: string,
  input: UpdatePageInput,
): Promise<Page | null> {
  const existing = await getPage(siteId, id);
  if (!existing) return null;

  const data: Prisma.PageUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.status !== undefined) {
    data.status = input.status;
    if (input.status === "publish" && !existing.publishedAt) {
      data.publishedAt = new Date();
    }
  }
  if (input.parentId !== undefined) {
    if (input.parentId === id) throw new Error("Page cannot be its own parent");
    const parentId = await checkParent(siteId, input.parentId);
    data.parent = parentId ? { connect: { id: parentId } } : { disconnect: true };
  }
  if (input.content !== undefined) {
    data.content = input.content as Prisma.InputJsonValue;
  }
  if (input.slug !== undefined) {
    data.slug = await uniqueSlug(siteId, input.slug, id);
  } else if (input.title !== undefined && input.title !== existing.title) {
    // keep slug unless explicitly changed — ponytail: no auto-rename on edit
  }

  return prisma.page.update({
    where: { id },
    data,
  });
}

export async function deletePage(siteId: string, id: string): Promise<boolean> {
  const existing = await getPage(siteId, id);
  if (!existing) return false;
  await prisma.page.delete({ where: { id } });
  return true;
}
