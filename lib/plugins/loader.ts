import { getHookBus, resetHookBus } from "@/lib/hooks";
import { networkPluginSlugs } from "@/lib/network/policy";
import { prisma } from "@/lib/prisma";
import { PLUGIN_REGISTRY } from "@/plugins/registry";
import { removeAdminPages, resetAdminPages } from "./admin-pages";
import { createPluginApi } from "./api";

/**
 * Boot loader. The first request for a site (per server process) runs `register(api)` for each
 * of its active plugins; after that the site's hook bus is ready. Activate/deactivate call
 * `reloadPlugins` so the change applies immediately in this process.
 */
const g = globalThis as unknown as { __rpPluginBoot?: Map<string, Promise<void>> };
const booted = (g.__rpPluginBoot ??= new Map());

/** Plugins running on a site: the network's, then its own active installs in install order. */
export async function activePluginSlugs(siteId: string): Promise<string[]> {
  const [rows, forced] = await Promise.all([
    prisma.pluginInstall.findMany({ where: { siteId, active: true }, orderBy: { installedAt: "asc" } }),
    networkPluginSlugs(siteId),
  ]);
  return [...new Set([...forced, ...rows.map((r) => r.slug)])];
}

async function boot(siteId: string) {
  resetHookBus(siteId);
  resetAdminPages(siteId);
  const bus = getHookBus(siteId);
  for (const slug of await activePluginSlugs(siteId)) {
    const entry = Object.hasOwn(PLUGIN_REGISTRY, slug) ? PLUGIN_REGISTRY[slug] : null;
    if (!entry) continue; // folder removed from the build; keep the row so the admin can still delete it
    try {
      const register = await entry.load();
      await register(createPluginApi(siteId, entry.manifest, bus));
    } catch (e) {
      // a broken plugin must not take the site down: drop whatever it half-registered and move on
      bus.removeOwner(slug);
      removeAdminPages(siteId, slug);
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
