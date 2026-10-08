/** ponytail: run with `npx tsx lib/comments.selfcheck.ts` */
import { PrismaClient } from "@prisma/client";
import { deleteComment, listApprovedComments, setCommentStatus, submitComment } from "./comments";
import { createPost, deletePost } from "./posts";

const prisma = new PrismaClient();

async function main() {
  const site = await prisma.site.findFirstOrThrow({ where: { isDefault: true } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@reactpress.local" } });

  const draft = await createPost(site.id, admin.id, { title: "Draft c", status: "draft" });
  const post = await createPost(site.id, admin.id, { title: "Pub c", status: "publish" });
  const base = { authorName: "Ann", authorEmail: "ann@example.com", content: "Nice" };

  let rejected = false;
  try {
    await submitComment(site.id, { ...base, postId: draft.id }, {});
  } catch {
    rejected = true;
  }
  console.assert(rejected, "no comments on drafts");

  console.assert((await submitComment(site.id, { ...base, postId: post.id, website: "bot" }, {})) === null, "honeypot dropped");

  const c = (await submitComment(site.id, { ...base, postId: post.id }, {}))!;
  console.assert(c.status === "pending", "anon comment pending");
  console.assert((await listApprovedComments(site.id, post.id)).length === 0, "hidden until approved");

  await setCommentStatus(site.id, c.id, "approved");
  console.assert((await listApprovedComments(site.id, post.id)).length === 1, "approved shows");
  await setCommentStatus(site.id, c.id, "spam");
  console.assert((await listApprovedComments(site.id, post.id)).length === 0, "spam hidden");
  await setCommentStatus(site.id, c.id, "trash");

  const trusted = (await submitComment(site.id, { ...base, postId: post.id }, { userId: admin.id }))!;
  console.assert(trusted.status === "approved", "moderator auto-approved");

  const spammy = (await submitComment(site.id, { ...base, postId: post.id, content: "http://a.co http://b.co http://c.co" }, {}))!;
  console.assert(spammy.status === "spam", "link spam flagged");

  await deleteComment(site.id, c.id);
  for (const p of [draft, post]) {
    await deletePost(site.id, p.id);
    await prisma.revision.deleteMany({ where: { entityId: p.id } });
  }
  console.log("comments self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
