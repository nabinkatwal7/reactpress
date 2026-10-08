import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { withSiteId } from "@/lib/site";
import type { CreateTermInput, UpdateTermInput } from "@/lib/validations/term";

async function uniqueSlug(siteId: string, taxonomy: string, base: string, excludeId?: string) {
  const root = slugify(base);
  let slug = root;
  let n = 2;
  for (;;) {
    const hit = await prisma.term.findFirst({
      where: {
        ...withSiteId(siteId, { taxonomy, slug }),
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!hit) return slug;
    slug = `${root}-${n++}`;
  }
}

export async function listTerms(siteId: string, taxonomy: string) {
  return prisma.term.findMany({
    where: withSiteId(siteId, { taxonomy }),
    orderBy: { name: "asc" },
    include: { _count: { select: { posts: true } } },
  });
}

export async function getTerm(siteId: string, id: string) {
  return prisma.term.findFirst({ where: withSiteId(siteId, { id }) });
}

async function checkParent(siteId: string, taxonomy: string, parentId?: string | null) {
  if (!parentId) return null;
  const parent = await prisma.term.findFirst({
    where: withSiteId(siteId, { id: parentId, taxonomy }),
    select: { id: true },
  });
  if (!parent) throw new Error("Parent term not found");
  return parent.id;
}

export async function createTerm(siteId: string, input: CreateTermInput) {
  return prisma.term.create({
    data: {
      siteId,
      taxonomy: input.taxonomy,
      name: input.name,
      slug: await uniqueSlug(siteId, input.taxonomy, input.slug ?? input.name),
      description: input.description || null,
      parentId: await checkParent(siteId, input.taxonomy, input.parentId),
    },
  });
}

export async function updateTerm(siteId: string, id: string, input: UpdateTermInput) {
  const existing = await getTerm(siteId, id);
  if (!existing) return null;

  const data: Prisma.TermUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description || null;
  if (input.slug !== undefined) {
    data.slug = await uniqueSlug(siteId, existing.taxonomy, input.slug, id);
  }
  if (input.parentId !== undefined) {
    if (input.parentId === id) throw new Error("Term cannot be its own parent");
    const parentId = await checkParent(siteId, existing.taxonomy, input.parentId);
    data.parent = parentId ? { connect: { id: parentId } } : { disconnect: true };
  }
  return prisma.term.update({ where: { id }, data });
}

export async function deleteTerm(siteId: string, id: string) {
  const existing = await getTerm(siteId, id);
  if (!existing) return false;
  await prisma.term.delete({ where: { id } });
  return true;
}

/** Replace a post's terms. Ignores ids that are not on this site. */
export async function setPostTerms(siteId: string, postId: string, termIds: string[]) {
  if (!(await prisma.post.count({ where: withSiteId(siteId, { id: postId }) }))) return;
  const valid = await prisma.term.findMany({
    where: { siteId, id: { in: termIds } },
    select: { id: true },
  });
  await prisma.$transaction([
    prisma.postTerm.deleteMany({ where: { postId } }),
    prisma.postTerm.createMany({ data: valid.map((t) => ({ postId, termId: t.id })) }),
  ]);
}
