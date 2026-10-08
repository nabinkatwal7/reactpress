/** ponytail: run with `npx tsx lib/theme/themes.selfcheck.ts` */
import { PrismaClient } from "@prisma/client";
import { activateTheme, getActiveThemeSlug, installTheme, listThemes, uninstallTheme } from "./themes";

const prisma = new PrismaClient();

async function main() {
  const site = await prisma.site.findFirstOrThrow({ where: { isDefault: true } });
  await prisma.themeInstall.deleteMany({ where: { siteId: site.id } });

  console.assert((await getActiveThemeSlug(site.id)) === "default", "default theme with no installs");
  const initial = await listThemes(site.id);
  console.assert(initial.length >= 2 && initial.find((t) => t.manifest.slug === "default")!.active, "listing marks default active");

  await installTheme(site.id, "midnight");
  console.assert((await getActiveThemeSlug(site.id)) === "default", "install does not activate");
  await activateTheme(site.id, "midnight");
  console.assert((await getActiveThemeSlug(site.id)) === "midnight", "activate switches theme");

  let blocked = false;
  try { await uninstallTheme(site.id, "midnight"); } catch { blocked = true; }
  console.assert(blocked, "cannot remove active theme");

  await activateTheme(site.id, "default");
  console.assert(await uninstallTheme(site.id, "midnight") === true, "inactive theme can be removed");

  let unknown = false;
  try { await installTheme(site.id, "../etc"); } catch { unknown = true; }
  console.assert(unknown, "unknown slug rejected");

  const actives = await prisma.themeInstall.count({ where: { siteId: site.id, active: true } });
  console.assert(actives === 1, "exactly one active");

  await prisma.themeInstall.deleteMany({ where: { siteId: site.id } });
  console.log("themes self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
