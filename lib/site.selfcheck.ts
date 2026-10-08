/**
 * ponytail: run with `npx tsx lib/site.selfcheck.ts`
 */
import { PrismaClient } from "@prisma/client";
import { withSiteId } from "./site";

const prisma = new PrismaClient();

async function main() {
  const site = await prisma.site.findFirstOrThrow({ where: { isDefault: true } });
  const scoped = withSiteId(site.id, { slug: "hello" });

  console.assert(scoped.siteId === site.id, "withSiteId must set siteId");
  console.assert(scoped.slug === "hello", "withSiteId must keep other filters");

  if (scoped.siteId !== site.id || scoped.slug !== "hello") {
    throw new Error("site self-check failed");
  }
  console.log(`site self-check passed (${site.slug})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
