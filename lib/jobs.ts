import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EntityType } from "@/lib/revisions";

export const PUBLISH_JOB = "publish";

type Payload = { entityType: EntityType; entityId: string };

/** Keep exactly one pending publish job per entity, matching its status. */
export async function syncPublishJob(
  siteId: string,
  entityType: EntityType,
  entityId: string,
  status: string,
  scheduledAt: Date | null,
) {
  await prisma.job.deleteMany({
    where: {
      siteId,
      type: PUBLISH_JOB,
      status: "pending",
      payload: { path: ["entityId"], equals: entityId },
    },
  });
  if (status !== "scheduled" || !scheduledAt) return;
  await prisma.job.create({
    data: {
      siteId,
      type: PUBLISH_JOB,
      runAt: scheduledAt,
      payload: { entityType, entityId } satisfies Payload as Prisma.InputJsonValue,
    },
  });
}

async function publishDue(siteId: string, { entityType, entityId }: Payload, now: Date) {
  const where = {
    id: entityId,
    siteId,
    status: "scheduled" as const,
    scheduledAt: { lte: now },
  };
  const data = { status: "publish" as const, publishedAt: now, scheduledAt: null };
  const res =
    entityType === "post"
      ? await prisma.post.updateMany({ where, data })
      : await prisma.page.updateMany({ where, data });
  return res.count;
}

/** Claim and run every due job. Safe to call concurrently. Returns counts. */
export async function runDueJobs(now = new Date()) {
  const due = await prisma.job.findMany({
    where: { status: "pending", runAt: { lte: now } },
    orderBy: { runAt: "asc" },
    take: 50,
  });

  let done = 0;
  let failed = 0;
  for (const job of due) {
    const claimed = await prisma.job.updateMany({
      where: { id: job.id, status: "pending" },
      data: { status: "running", attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue;

    try {
      if (job.type === PUBLISH_JOB) {
        await publishDue(job.siteId, job.payload as Payload, now);
      }
      await prisma.job.update({ where: { id: job.id }, data: { status: "done" } });
      done += 1;
    } catch (e) {
      await prisma.job.update({
        where: { id: job.id },
        data: { status: "failed", lastError: e instanceof Error ? e.message : String(e) },
      });
      failed += 1;
    }
  }
  return { done, failed };
}
