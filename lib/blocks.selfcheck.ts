/** ponytail: run with `npx tsx lib/blocks.selfcheck.ts` */
import { isDeepStrictEqual } from "node:util";
import { PrismaClient } from "@prisma/client";
import { createPostSchema } from "./validations/post";
import { createPost, deletePost, getPost } from "./posts";
import { emptyBlock, safeImageUrl, toBlocks, BLOCK_TYPES } from "./blocks";
import { searchContent } from "./search";

const prisma = new PrismaClient();

async function main() {
  const site = await prisma.site.findFirstOrThrow({ where: { isDefault: true } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@reactpress.local" } });

  const blocks = BLOCK_TYPES.map((t) => emptyBlock(t.type));
  console.assert(JSON.stringify(toBlocks(blocks)) === JSON.stringify(blocks), "empty blocks round-trip");
  console.assert(toBlocks([{ type: "mystery", text: "kept" }])[0]?.type === "paragraph", "unknown type degrades to paragraph");
  console.assert(toBlocks("nope").length === 0, "non-array -> []");
  console.assert(safeImageUrl("javascript:alert(1)") === null && safeImageUrl("/media/x.png") !== null, "image url allow-list");
  console.assert(!createPostSchema.safeParse({ title: "t", content: [{ nope: 1 }] }).success, "block needs type");

  const content = [
    { type: "heading", level: 2, text: "Blockquartz heading" },
    { type: "list", ordered: false, text: "one\ntwo" },
  ];
  const post = await createPost(site.id, admin.id, { title: "Blocks", status: "publish", content });
  console.assert(isDeepStrictEqual((await getPost(site.id, post.id))?.content, content), "stored as-is");
  console.assert((await searchContent(site.id, "blockquartz")).some((r) => r.id === post.id), "block text searchable");

  await deletePost(site.id, post.id);
  await prisma.revision.deleteMany({ where: { entityId: post.id } });
  console.log("blocks self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
