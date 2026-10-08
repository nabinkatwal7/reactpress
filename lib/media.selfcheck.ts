/** ponytail: run with `npx tsx lib/media.selfcheck.ts` */
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { absolutePath, createMedia, deleteMedia } from "./media";
import { createPost, deletePost, getPost, updatePost } from "./posts";

const prisma = new PrismaClient();

async function main() {
  const site = await prisma.site.findFirstOrThrow({ where: { isDefault: true } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@reactpress.local" } });

  const png = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "pic.png");
  const media = await createMedia(site.id, admin.id, png);
  console.assert(media.mimeType === "image/png", "mime from extension");
  console.assert(existsSync(absolutePath(media.path)), "file on disk");

  let rejected = false;
  try {
    await createMedia(site.id, admin.id, new File(["<svg/>"], "evil.svg"));
  } catch {
    rejected = true;
  }
  console.assert(rejected, "svg rejected");

  const post = await createPost(site.id, admin.id, {
    title: "With image",
    status: "draft",
    featuredMediaId: media.id,
  });
  console.assert((await getPost(site.id, post.id))?.featuredMedia?.id === media.id, "attached");

  await updatePost(site.id, post.id, { featuredMediaId: null });
  console.assert((await getPost(site.id, post.id))?.featuredMediaId === null, "detached");
  await updatePost(site.id, post.id, { featuredMediaId: media.id });

  await deleteMedia(site.id, media.id);
  console.assert(!existsSync(absolutePath(media.path)), "file removed");
  console.assert((await getPost(site.id, post.id))?.featuredMediaId === null, "post detached on delete");

  await deletePost(site.id, post.id);
  await prisma.revision.deleteMany({ where: { entityId: post.id } });
  console.log("media self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
