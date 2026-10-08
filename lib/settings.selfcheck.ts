/** ponytail: run with `npx tsx lib/settings.selfcheck.ts` */
import { PrismaClient } from "@prisma/client";
import { loadSettings, saveSettings, settingsPatchSchema } from "./settings";

const prisma = new PrismaClient();

async function main() {
  const site = await prisma.site.findFirstOrThrow({ where: { isDefault: true } });
  const before = await loadSettings(site.id);

  const saved = await saveSettings(site.id, { site_title: "Selfcheck Site", posts_per_page: 3, post_base: "blog" });
  console.assert(saved.site_title === "Selfcheck Site" && saved.post_base === "blog", "saved");
  console.assert((await loadSettings(site.id)).posts_per_page === 3, "persisted");

  console.assert(!settingsPatchSchema.safeParse({ bogus: 1 }).success, "unknown key rejected");
  console.assert(!settingsPatchSchema.safeParse({ post_base: "../x" }).success, "bad base rejected");

  let threw = false;
  try {
    await saveSettings(site.id, { homepage_mode: "page", homepage_page_id: "nope" });
  } catch {
    threw = true;
  }
  console.assert(threw, "homepage page must exist");

  await saveSettings(site.id, { ...before });
  await prisma.setting.deleteMany({ where: { siteId: site.id } });
  console.log("settings self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
