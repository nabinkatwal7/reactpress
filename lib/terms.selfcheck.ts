/** ponytail: run with `npx tsx lib/terms.selfcheck.ts` */
import { PrismaClient } from "@prisma/client";
import { createPost, deletePost, listPosts } from "./posts";
import { createTerm, deleteTerm } from "./terms";

const prisma = new PrismaClient();

async function main() {
  const site = await prisma.site.findFirstOrThrow({ where: { isDefault: true } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@reactpress.local" } });

  const cat = await createTerm(site.id, { taxonomy: "category", name: "Selfcheck Cat" });
  const tag = await createTerm(site.id, { taxonomy: "tag", name: "Selfcheck Cat" });
  const a = await createPost(site.id, admin.id, { title: "In cat", status: "draft", termIds: [cat.id] });
  const b = await createPost(site.id, admin.id, { title: "In tag", status: "draft", termIds: [tag.id] });

  const inCat = await listPosts(site.id, { taxonomy: "category", term: cat.slug });
  console.assert(inCat.length === 1 && inCat[0].id === a.id, "filter by category");
  const inTag = await listPosts(site.id, { taxonomy: "tag", term: tag.slug });
  console.assert(inTag.length === 1 && inTag[0].id === b.id, "same slug, other taxonomy");

  for (const p of [a, b]) {
    await deletePost(site.id, p.id);
    await prisma.revision.deleteMany({ where: { entityId: p.id } });
  }
  await deleteTerm(site.id, cat.id);
  await deleteTerm(site.id, tag.id);
  console.log("terms self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
