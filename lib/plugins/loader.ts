import { getHookBus, resetHookBus } from "@/lib/hooks";
import { prisma } from "@/lib/prisma";
import { PLUGIN_REGISTRY } from "@/plugins/registry";
import { createPluginApi } from "./api";

/**
 * Boot loader. The first request for a site (per server process) runs `register(api)` for each
 * of its active plugins; after that the site's hook bus is ready. Activate/deactivate call
 * `reloadPlugins` so the change applies immediately in this process.
 */
const g = globalThis as unknown as { __rpPluginBoot?: Map<string, Promise<void>> };
const booted = (g.__rpPluginBoot ??= new Map());

async function boot(siteId: string) {
  resetHookBus(siteId);
  const bus = getHookBus(siteId);
  const rows = await prisma.pluginInstall.findMany({ where: { siteId, active: true }, orderBy: { installedAt: "asc" } });
  for (const { slug } of rows) {
    const entry = Object.hasOwn(PLUGIN_REGISTRY, slug) ? PLUGIN_REGISTRY[slug] : null;
    if (!entry) continue; // folder removed from the build; keep the row so the admin can still delete it
    try {
      const register = await entry.load();
      await register(createPluginApi(siteId, slug, bus));
    } catch (e) {
      // a broken plugin must not take the site down: drop whatever it half-registered and move on
      bus.removeOwner(slug);
      console.error(`[plugins] "${slug}" failed to register:`, e);
    }
  }
  await bus.doAction("plugins_loaded");
}

export function ensurePluginsLoaded(siteId: string): Promise<void> {
  let p = booted.get(siteId);
  if (!p) {
    p = boot(siteId).catch((e) => {
      booted.delete(siteId); // retry on the next request
      console.error("[plugins] boot failed:", e);
    });
    booted.set(siteId, p);
  }
  return p;
}

export function reloadPlugins(siteId: string): Promise<void> {
  booted.delete(siteId);
  return ensurePluginsLoaded(siteId);
}
