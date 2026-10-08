/** ponytail: run with `npx tsx lib/revisions.selfcheck.ts` */
import { PrismaClient } from "@prisma/client";
import { createPost, deletePost, getPost, updatePost } from "./posts";
import { listRevisions, restoreRevision, saveAutosave } from "./revisions";

const prisma = new PrismaClient();

async function main() {
  const site = await prisma.site.findFirstOrThrow({ where: { isDefault: true } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@reactpress.local" } });

  const post = await createPost(site.id, admin.id, { title: "v1", status: "draft", content: [] });
  await updatePost(site.id, post.id, { title: "v2" });
  await saveAutosave(site.id, "post", post.id, admin.id, { title: "v3-auto", content: [] });
  await saveAutosave(site.id, "post", post.id, admin.id, { title: "v3-auto2", content: [] });

  const revs = await listRevisions(site.id, "post", post.id);
  console.assert(revs.filter((r) => r.kind === "revision").length === 2, "2 revisions");
  console.assert(revs.filter((r) => r.kind === "autosave").length === 1, "1 autosave row");
  console.assert((await getPost(site.id, post.id))?.title === "v2", "autosave leaves live post alone");

  const v1 = revs.find((r) => r.title === "v1")!;
  await restoreRevision(site.id, v1.id, admin.id);
  console.assert((await getPost(site.id, post.id))?.title === "v1", "restore v1");

  await deletePost(site.id, post.id);
  await prisma.revision.deleteMany({ where: { entityId: post.id } });
  console.log("revisions self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
