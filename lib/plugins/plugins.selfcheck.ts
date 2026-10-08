/** ponytail: run with `npx tsx lib/plugins/plugins.selfcheck.ts` (needs the dev database) */
import { PrismaClient } from "@prisma/client";
import { applyFilters, getHookBus } from "@/lib/hooks";
import { ensurePluginsLoaded } from "./loader";
import { activatePlugin, deactivatePlugin, deletePlugin, installPlugin, listPlugins } from "./plugins";

const prisma = new PrismaClient();
const ctx = { kind: "post", id: "x" };
const body = [{ type: "paragraph", text: "word ".repeat(440) }];

async function main() {
  const site = await prisma.site.findFirstOrThrow({ where: { isDefault: true } });
  await prisma.pluginInstall.deleteMany({ where: { siteId: site.id } });

  const first = (await listPlugins(site.id)).find((p) => p.manifest.slug === "reading-time")!;
  console.assert(first && !first.installed && !first.active, "listed but not installed");

  await installPlugin(site.id, "reading-time");
  await ensurePluginsLoaded(site.id);
  console.assert(!getHookBus(site.id).hasFilter("the_content"), "install alone does not load the plugin");

  await activatePlugin(site.id, "reading-time");
  const out = (await applyFilters(site.id, "the_content", body, ctx)) as { text: string }[];
  console.assert(out.length === 2 && out[0].text === "2 min read", "active plugin hooks the content");
  const page = (await applyFilters(site.id, "the_content", body, { kind: "page", id: "y" })) as unknown[];
  console.assert(page.length === 1, "plugin ignores pages");

  let blocked = false;
  try { await deletePlugin(site.id, "reading-time"); } catch { blocked = true; }
  console.assert(blocked, "cannot delete an active plugin");

  // simulate a fresh process: only the DB says what is active ("active plugins load on boot")
  getHookBus(site.id).removeOwner("reading-time");
  await (await import("./loader")).reloadPlugins(site.id);
  console.assert(getHookBus(site.id).hasFilter("the_content"), "active plugin loads on boot");

  await deactivatePlugin(site.id, "reading-time");
  console.assert(((await applyFilters(site.id, "the_content", body, ctx)) as unknown[]).length === 1, "deactivate removes handlers");

  console.assert(await deletePlugin(site.id, "reading-time") === true, "inactive plugin can be deleted");
  console.assert(await deletePlugin(site.id, "reading-time") === false, "second delete is a no-op");

  let unknown = false;
  try { await installPlugin(site.id, "../etc"); } catch { unknown = true; }
  console.assert(unknown, "unknown slug rejected");

  console.log("plugins self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
