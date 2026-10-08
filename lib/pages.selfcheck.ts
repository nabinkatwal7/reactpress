/**
 * ponytail: run with `npx tsx lib/pages.selfcheck.ts`
 */
import { PrismaClient } from "@prisma/client";
import { createPage, deletePage, getPage, listPages, updatePage } from "./pages";

const prisma = new PrismaClient();

async function main() {
  const site = await prisma.site.findFirstOrThrow({ where: { isDefault: true } });
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@reactpress.local" },
  });

  const created = await createPage(site.id, admin.id, {
    title: "Selfcheck Page",
    status: "draft",
    content: [{ type: "paragraph", text: "hi" }],
  });

  const listed = await listPages(site.id);
  console.assert(listed.some((p) => p.id === created.id), "list should include created");

  const got = await getPage(site.id, created.id);
  console.assert(got?.slug === "selfcheck-page", "slugify title");

  const updated = await updatePage(site.id, created.id, {
    title: "Selfcheck Page Updated",
    status: "publish",
  });
  console.assert(updated?.status === "publish", "update status");
  console.assert(!!updated?.publishedAt, "publish sets publishedAt");

  const deleted = await deletePage(site.id, created.id);
  console.assert(deleted === true, "delete returns true");
  console.assert((await getPage(site.id, created.id)) === null, "gone after delete");

  console.log("pages CRUD self-check passed");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
