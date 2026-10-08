import type { Prisma, Revision } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withSiteId } from "@/lib/site";

export type EntityType = "post" | "page";

const MAX_REVISIONS = 50;

function delegate(type: EntityType) {
  return type === "post" ? prisma.post : prisma.page;
}

async function findEntity(siteId: string, type: EntityType, id: string) {
  // post/page delegates share the fields we need; cast keeps one code path
  return (delegate(type) as typeof prisma.post).findFirst({
    where: withSiteId(siteId, { id }),
    select: { id: true, title: true, content: true },
  });
}

/** Full snapshot; skips if identical to the latest saved revision. */
export async function createRevision(
  siteId: string,
  type: EntityType,
  entityId: string,
  authorId: string | null,
  snap: { title: string; content: unknown },
): Promise<Revision | null> {
  const last = await prisma.revision.findFirst({
    where: withSiteId(siteId, { entityType: type, entityId, kind: "revision" as const }),
    orderBy: { createdAt: "desc" },
  });
  if (
    last &&
    last.title === snap.title &&
    JSON.stringify(last.content) === JSON.stringify(snap.content)
  ) {
    return null;
  }

  const rev = await prisma.revision.create({
    data: {
      siteId,
      entityType: type,
      entityId,
      authorId,
      kind: "revision",
      title: snap.title,
      content: snap.content as Prisma.InputJsonValue,
    },
  });

  const old = await prisma.revision.findMany({
    where: withSiteId(siteId, { entityType: type, entityId, kind: "revision" as const }),
    orderBy: { createdAt: "desc" },
    skip: MAX_REVISIONS,
    select: { id: true },
  });
  if (old.length) {
    await prisma.revision.deleteMany({ where: { id: { in: old.map((r) => r.id) } } });
  }
  return rev;
}

/** One autosave row per entity+user; never touches the live entity. */
export async function saveAutosave(
  siteId: string,
  type: EntityType,
  entityId: string,
  authorId: string,
  snap: { title: string; content: unknown },
): Promise<Revision | null> {
  if (!(await findEntity(siteId, type, entityId))) return null;

  const existing = await prisma.revision.findFirst({
    where: withSiteId(siteId, { entityType: type, entityId, kind: "autosave" as const, authorId }),
  });
  const data = {
    title: snap.title,
    content: snap.content as Prisma.InputJsonValue,
  };
  if (existing) {
    return prisma.revision.update({ where: { id: existing.id }, data });
  }
  return prisma.revision.create({
    data: { siteId, entityType: type, entityId, authorId, kind: "autosave", ...data },
  });
}

export async function listRevisions(siteId: string, type: EntityType, entityId: string) {
  return prisma.revision.findMany({
    where: withSiteId(siteId, { entityType: type, entityId }),
    orderBy: { createdAt: "desc" },
  });
}

export async function getRevision(siteId: string, id: string) {
  return prisma.revision.findFirst({ where: withSiteId(siteId, { id }) });
}

/** Copy a revision back onto the live entity (and snapshot the result). */
export async function restoreRevision(siteId: string, id: string, userId: string) {
  const rev = await getRevision(siteId, id);
  if (!rev) return null;
  const type = rev.entityType as EntityType;
  const data = { title: rev.title, content: rev.content as Prisma.InputJsonValue };

  const exists = await findEntity(siteId, type, rev.entityId);
  if (!exists) return null;
  await (delegate(type) as typeof prisma.post).update({ where: { id: rev.entityId }, data });
  await createRevision(siteId, type, rev.entityId, userId, data);
  if (rev.kind === "autosave") {
    await prisma.revision.delete({ where: { id: rev.id } });
  }
  return { entityType: type, entityId: rev.entityId };
}
