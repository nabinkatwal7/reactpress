/** ponytail: run with `npx tsx lib/content-list.selfcheck.ts` */
import { PrismaClient } from "@prisma/client";
import { bulkUpdate, queryPosts, runBulk, statusCounts } from "./content-list";
import { createPost, deletePost } from "./posts";

const prisma = new PrismaClient();

async function main() {
  const site = await prisma.site.findFirstOrThrow({ where: { isDefault: true } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@reactpress.local" } });
  const sub = await prisma.user.findUniqueOrThrow({ where: { email: "subscriber@reactpress.local" } });

  const mk = (title: string) => createPost(site.id, admin.id, { title, status: "draft" });
  const [a, b, c] = await Promise.all([mk("Bulkzed one"), mk("Bulkzed two"), mk("Other thing")]);
  const ids = [a.id, b.id];

  console.assert((await queryPosts(site.id, { q: "bulkzed" })).total === 2, "title search");
  console.assert((await queryPosts(site.id, { status: "draft", q: "bulkzed" })).total === 2, "status filter");

  console.assert(await bulkUpdate(site.id, "post", ids, "publish") === 2, "bulk publish count");
  const pub = await prisma.post.findMany({ where: { id: { in: ids } } });
  console.assert(pub.every((p) => p.status === "publish" && p.publishedAt), "published with date");

  await bulkUpdate(site.id, "post", ids, "trash");
  console.assert((await queryPosts(site.id, { q: "bulkzed" })).total === 0, "All hides trash");
  console.assert((await queryPosts(site.id, { status: "trash", q: "bulkzed" })).total === 2, "trash tab shows them");
  console.assert((await statusCounts(site.id, "post")).trash! >= 2, "counts");

  console.assert(await bulkUpdate(site.id, "post", [c.id], "delete") === 0, "cannot hard-delete non-trashed");
  const denied = await runBulk(sub.id, site.id, "post", ids, "restore");
  console.assert("error" in denied, "subscriber denied");

  console.assert(await bulkUpdate(site.id, "post", ids, "delete") === 2, "delete from trash");
  await deletePost(site.id, c.id);
  for (const p of [a, b, c]) await prisma.revision.deleteMany({ where: { entityId: p.id } });
  console.log("content-list self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
