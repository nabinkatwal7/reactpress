/**
 * ponytail: run with `npx tsx lib/posts.selfcheck.ts`
 */
import { PrismaClient } from "@prisma/client";
import { createPost, deletePost, getPost, listPosts, updatePost } from "./posts";

const prisma = new PrismaClient();

async function main() {
  const site = await prisma.site.findFirstOrThrow({ where: { isDefault: true } });
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@reactpress.local" },
  });

  const created = await createPost(site.id, admin.id, {
    title: "Selfcheck Post",
    status: "draft",
    content: [{ type: "paragraph", text: "hi" }],
  });

  const listed = await listPosts(site.id);
  console.assert(listed.some((p) => p.id === created.id), "list should include created");

  const got = await getPost(site.id, created.id);
  console.assert(got?.slug === "selfcheck-post", "slugify title");

  const updated = await updatePost(site.id, created.id, {
    title: "Selfcheck Post Updated",
    status: "publish",
  });
  console.assert(updated?.status === "publish", "update status");
  console.assert(!!updated?.publishedAt, "publish sets publishedAt");

  const deleted = await deletePost(site.id, created.id);
  console.assert(deleted === true, "delete returns true");
  console.assert((await getPost(site.id, created.id)) === null, "gone after delete");

  console.log("posts CRUD self-check passed");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
