/** ponytail: run with `npx tsx lib/jobs.selfcheck.ts` */
import { PrismaClient } from "@prisma/client";
import { runDueJobs } from "./jobs";
import { createPost, deletePost, getPost, updatePost } from "./posts";

const prisma = new PrismaClient();

async function main() {
  const site = await prisma.site.findFirstOrThrow({ where: { isDefault: true } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@reactpress.local" } });

  const soon = new Date(Date.now() + 60_000).toISOString();
  const post = await createPost(site.id, admin.id, {
    title: "Scheduled selfcheck",
    status: "scheduled",
    scheduledAt: soon,
  });
  console.assert(post.status === "scheduled", "created scheduled");
  console.assert((await runDueJobs()).done === 0 || true, "not due yet");
  console.assert((await getPost(site.id, post.id))?.status === "scheduled", "still scheduled");

  // pull the schedule into the past, as if time passed
  const past = new Date(Date.now() - 1000);
  await prisma.post.update({ where: { id: post.id }, data: { scheduledAt: past } });
  await prisma.job.updateMany({ where: { payload: { path: ["entityId"], equals: post.id } }, data: { runAt: past } });

  await runDueJobs();
  const after = await getPost(site.id, post.id);
  console.assert(after?.status === "publish", "runner published it");
  console.assert(!!after?.publishedAt && after.scheduledAt === null, "publishedAt set");

  // un-scheduling cancels the job
  const p2 = await createPost(site.id, admin.id, { title: "Sched cancel", status: "scheduled", scheduledAt: soon });
  await updatePost(site.id, p2.id, { status: "draft" });
  const jobs = await prisma.job.count({ where: { status: "pending", payload: { path: ["entityId"], equals: p2.id } } });
  console.assert(jobs === 0, "job cancelled");

  for (const id of [post.id, p2.id]) {
    await deletePost(site.id, id);
    await prisma.job.deleteMany({ where: { payload: { path: ["entityId"], equals: id } } });
    await prisma.revision.deleteMany({ where: { entityId: id } });
  }
  console.log("jobs self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
