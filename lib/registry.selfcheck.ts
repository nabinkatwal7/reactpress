/** ponytail: run with `npx tsx lib/registry.selfcheck.ts` */
import { PrismaClient } from "@prisma/client";
import { createPost, deletePost, listPosts } from "./posts";
import { createPostType, createTaxonomy, deletePostType, deleteTaxonomy, getPostType, registerPostType } from "./registry";
import { createTerm, deleteTerm } from "./terms";

const prisma = new PrismaClient();

async function main() {
  const site = await prisma.site.findFirstOrThrow({ where: { isDefault: true } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@reactpress.local" } });

  await createPostType(site.id, { key: "selfcheck_product", label: "Products" });
  await createTaxonomy(site.id, { key: "selfcheck_genre", label: "Genres" });
  registerPostType({ key: "selfcheck_code", label: "Code", singular: "Code", taxonomies: [] });
  console.assert((await getPostType(site.id, "selfcheck_code"))?.source === "code", "code type");
  console.assert((await getPostType(site.id, "selfcheck_product"))?.source === "db", "db type");

  const item = await createPost(site.id, admin.id, { title: "Widget", status: "draft", type: "selfcheck_product" });
  console.assert((await listPosts(site.id)).every((p) => p.id !== item.id), "not in posts list");
  console.assert((await listPosts(site.id, { type: "selfcheck_product" })).length === 1, "in type list");
  const term = await createTerm(site.id, { taxonomy: "selfcheck_genre", name: "Sci" });

  let threw = false;
  try {
    await createPost(site.id, admin.id, { title: "x", status: "draft", type: "nope" });
  } catch {
    threw = true;
  }
  console.assert(threw, "unknown type rejected");

  await deletePost(site.id, item.id);
  await prisma.revision.deleteMany({ where: { entityId: item.id } });
  await deleteTerm(site.id, term.id);
  await deletePostType(site.id, "selfcheck_product");
  await deleteTaxonomy(site.id, "selfcheck_genre");
  console.log("registry self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
