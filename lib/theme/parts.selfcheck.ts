/** ponytail: run with `npx tsx lib/theme/parts.selfcheck.ts` */
import { PrismaClient } from "@prisma/client";
import { getPartContent, isPartName, resetPart, savePart } from "./parts";

const prisma = new PrismaClient();

async function main() {
  const site = await prisma.site.findFirstOrThrow({ where: { isDefault: true } });
  await prisma.templatePart.deleteMany({ where: { siteId: site.id, theme: "selfcheck" } });

  console.assert(isPartName("header") && isPartName("footer") && !isPartName("sidebar"), "part names");
  console.assert(Object.keys(await getPartContent(site.id, "selfcheck")).length === 0, "no override by default");

  await savePart(site.id, "selfcheck", "footer", [{ type: "paragraph", text: "Hi" }]);
  await savePart(site.id, "selfcheck", "footer", [{ type: "paragraph", text: "Hello" }]);
  const got = await getPartContent(site.id, "selfcheck");
  console.assert(got.footer?.length === 1 && (got.footer[0] as { text: string }).text === "Hello", "upsert");
  console.assert(!("header" in got), "other parts untouched");
  console.assert((await getPartContent(site.id, "default")).footer === undefined, "scoped per theme");

  console.assert(await resetPart(site.id, "selfcheck", "footer"), "reset");
  console.assert(Object.keys(await getPartContent(site.id, "selfcheck")).length === 0, "back to default");
  console.log("parts self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
