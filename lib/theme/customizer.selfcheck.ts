/** ponytail: run with `npx tsx lib/theme/customizer.selfcheck.ts` */
import { PrismaClient } from "@prisma/client";
import { createMenu, deleteMenu, getMenuForLocation } from "../menus";
import { discardDraft, getDraft, getLiveValues, publishDraft, saveDraft } from "./customizer";
import { THEME_REGISTRY } from "@/themes/registry";

const prisma = new PrismaClient();
const manifest = THEME_REGISTRY.default.manifest;

async function main() {
  const site = await prisma.site.findFirstOrThrow({ where: { isDefault: true } });
  await prisma.themeMods.deleteMany({ where: { siteId: site.id } });
  await prisma.menuLocation.deleteMany({ where: { siteId: site.id } });
  const menu = await createMenu(site.id, "Customizer selfcheck");

  const live0 = await getLiveValues(site.id, manifest);
  console.assert(live0.mods.primary_color === "#1d4ed8", "live starts at theme defaults");

  const draft = await saveDraft(site.id, manifest, {
    mods: { primary_color: "#ff0000", logo: "/media/x.png", bogus: "x", text_color: "not-a-color" },
    homepage_mode: "latest",
    homepage_page_id: null,
    menus: { primary: menu.id, footer: null },
  });
  console.assert(draft.mods.primary_color === "#ff0000" && draft.mods.logo === "/media/x.png", "draft saved");
  console.assert(!("bogus" in draft.mods), "unknown keys dropped");
  console.assert(draft.mods.text_color === "#171717", "invalid color falls back to default");

  const live1 = await getLiveValues(site.id, manifest);
  console.assert(live1.mods.primary_color === "#1d4ed8" && live1.menus.primary === null, "draft does not touch live");
  console.assert((await getDraft(site.id, manifest))?.mods.primary_color === "#ff0000", "draft readable");

  let bad = 0;
  for (const input of [
    { ...draft, homepage_mode: "page", homepage_page_id: "nope" },
    { ...draft, menus: { primary: "nope", footer: null } },
  ]) {
    try { await saveDraft(site.id, manifest, input); } catch { bad++; }
  }
  console.assert(bad === 2, "bad homepage page / menu id rejected");

  await publishDraft(site.id, manifest);
  const live2 = await getLiveValues(site.id, manifest);
  console.assert(live2.mods.primary_color === "#ff0000" && live2.menus.primary === menu.id, "publish applies draft");
  console.assert((await getDraft(site.id, manifest)) === null, "draft cleared after publish");
  console.assert(Array.isArray(await getMenuForLocation(site.id, "primary")), "menu location assigned");

  let none = false;
  try { await publishDraft(site.id, manifest); } catch { none = true; }
  console.assert(none, "publish without draft refused");

  await saveDraft(site.id, manifest, { ...live2 });
  await discardDraft(site.id, manifest);
  console.assert((await getDraft(site.id, manifest)) === null, "discard clears the draft");

  await prisma.themeMods.deleteMany({ where: { siteId: site.id } });
  await prisma.menuLocation.deleteMany({ where: { siteId: site.id } });
  await deleteMenu(site.id, menu.id);
  console.log("customizer self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
