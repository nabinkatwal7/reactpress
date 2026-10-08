/** ponytail: run with `npx tsx lib/search.selfcheck.ts` */
import { PrismaClient } from "@prisma/client";
import { createPage, deletePage } from "./pages";
import { createPost, deletePost, updatePost } from "./posts";
import { searchContent } from "./search";

const prisma = new PrismaClient();

async function main() {
  const site = await prisma.site.findFirstOrThrow({ where: { isDefault: true } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@reactpress.local" } });

  const word = "zyxquartz";
  const inTitle = await createPost(site.id, admin.id, { title: `${word} guide`, status: "publish" });
  const inBody = await createPost(site.id, admin.id, {
    title: "Other article",
    status: "publish",
    content: [{ type: "paragraph", text: `Some text mentioning ${word} once <script>x</script>` }],
  });
  const draft = await createPost(site.id, admin.id, { title: `${word} draft`, status: "draft" });
  const page = await createPage(site.id, admin.id, { title: `About ${word}`, status: "publish" });

  const results = await searchContent(site.id, word);
  const ids = results.map((r) => r.id);
  console.assert(ids.includes(inTitle.id) && ids.includes(inBody.id) && ids.includes(page.id), "finds title/body/page hits");
  console.assert(!ids.includes(draft.id), "drafts excluded");
  console.assert(results.findIndex((r) => r.id === inTitle.id) < results.findIndex((r) => r.id === inBody.id), "title hit outranks body hit");
  console.assert(results.find((r) => r.id === inBody.id)!.excerpt.includes("<mark>"), "excerpt highlighted");
  console.assert(!results.find((r) => r.id === inBody.id)!.excerpt.includes("<script>"), "excerpt escaped");

  await updatePost(site.id, draft.id, { status: "publish" });
  console.assert((await searchContent(site.id, word)).some((r) => r.id === draft.id), "publishing makes it searchable");
  await updatePost(site.id, inBody.id, { content: [{ type: "paragraph", text: "nothing relevant" }] });
  console.assert(!(await searchContent(site.id, word)).some((r) => r.id === inBody.id), "index follows edits");

  console.assert((await searchContent(site.id, "")).length === 0, "empty query");
  await searchContent(site.id, `"unbalanced quote & ! ( | `); // must not throw

  for (const p of [inTitle, inBody, draft]) {
    await deletePost(site.id, p.id);
    await prisma.revision.deleteMany({ where: { entityId: p.id } });
  }
  await deletePage(site.id, page.id);
  await prisma.revision.deleteMany({ where: { entityId: page.id } });
  console.log("search self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
