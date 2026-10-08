/** ponytail: run with `npx tsx lib/network/network.selfcheck.ts` (needs the dev database) */
import { PrismaClient } from "@prisma/client";
import { activatePlugin, deactivatePlugin, deletePlugin, listPlugins } from "@/lib/plugins/plugins";
import { reloadPlugins } from "@/lib/plugins/loader";
import { applyFilters } from "@/lib/hooks";
import { activateTheme, listThemes } from "@/lib/theme/themes";
import { setEnabledThemes, setNetworkPlugins } from "./policy";
import { createSite, deleteSite, getDefaultNetwork } from "./sites";
import { isSuperAdmin, setSuperAdmin } from "./users";

const prisma = new PrismaClient();
const fails = (fn: () => Promise<unknown>) => fn().then(() => false, () => true);

async function main() {
  const net = await getDefaultNetwork();
  const main = await prisma.site.findFirstOrThrow({ where: { isDefault: true } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@reactpress.local" } });
  const sub = await prisma.user.findUniqueOrThrow({ where: { email: "subscriber@reactpress.local" } });
  await prisma.site.deleteMany({ where: { slug: { startsWith: "sc-" } } });
  const second = await createSite(net.id, { name: "Second", slug: "sc-second" });

  // super admin flag
  console.assert(await isSuperAdmin(admin.id), "seeded admin is a super admin");
  console.assert(!(await isSuperAdmin(sub.id)), "subscriber is not");
  console.assert(!(await isSuperAdmin(null)), "no user is not");
  console.assert(await fails(() => setSuperAdmin(admin.id, false)), "last super admin cannot be revoked");
  await setSuperAdmin(sub.id, true);
  console.assert(await isSuperAdmin(sub.id), "grant works");
  await setSuperAdmin(admin.id, false);
  await setSuperAdmin(admin.id, true);
  await setSuperAdmin(sub.id, false);
  console.assert(!(await isSuperAdmin(sub.id)), "revoke works while another super admin exists");

  // network themes
  await prisma.themeInstall.deleteMany({ where: { siteId: { in: [main.id, second.id] } } });
  console.assert((await listThemes(second.id)).every((t) => t.allowed), "all themes allowed by default");
  await setEnabledThemes(net.id, ["default"]);
  const themes = await listThemes(second.id);
  console.assert(themes.find((t) => t.manifest.slug === "midnight")!.allowed === false, "midnight blocked");
  console.assert(await fails(() => activateTheme(second.id, "midnight")), "blocked theme cannot be activated");
  await activateTheme(second.id, "default");
  console.assert(await fails(() => setEnabledThemes(net.id, ["nope"])), "unknown theme rejected");
  await setEnabledThemes(net.id, []);
  await activateTheme(second.id, "midnight");
  await setEnabledThemes(net.id, ["default"]);
  console.assert((await listThemes(second.id)).find((t) => t.manifest.slug === "midnight")!.allowed, "theme in use stays allowed");
  await setEnabledThemes(net.id, []);

  // network plugins run on every site and cannot be switched off by a site
  await prisma.pluginInstall.deleteMany({ where: { siteId: { in: [main.id, second.id] } } });
  const body = [{ type: "paragraph", text: "word ".repeat(440) }];
  const ctx = { kind: "post", id: "x" };
  await setNetworkPlugins(net.id, ["reading-time"]);
  await reloadPlugins(main.id);
  await reloadPlugins(second.id);
  for (const id of [main.id, second.id]) {
    console.assert(((await applyFilters(id, "the_content", body, ctx)) as unknown[]).length === 2, "network plugin runs on each site");
    const listed = (await listPlugins(id)).find((p) => p.manifest.slug === "reading-time")!;
    console.assert(listed.active && listed.networkActive, "listed as network active");
  }
  console.assert(await fails(() => deactivatePlugin(second.id, "reading-time")), "site cannot deactivate a network plugin");
  console.assert(await fails(() => deletePlugin(second.id, "reading-time")), "site cannot delete a network plugin");
  console.assert(await fails(() => setNetworkPlugins(net.id, ["nope"])), "unknown plugin rejected");

  await setNetworkPlugins(net.id, []);
  await reloadPlugins(second.id);
  console.assert(((await applyFilters(second.id, "the_content", body, ctx)) as unknown[]).length === 1, "plugin stops when removed from the network");
  await activatePlugin(second.id, "reading-time");
  await reloadPlugins(main.id);
  console.assert(((await applyFilters(main.id, "the_content", body, ctx)) as unknown[]).length === 1, "site-level activation stays on that site");
  await deactivatePlugin(second.id, "reading-time");
  await deletePlugin(second.id, "reading-time");

  await deleteSite(second.id);
  console.log("network self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
