import { prisma } from "@/lib/prisma";
import { PLUGIN_REGISTRY } from "@/plugins/registry";
import { THEME_REGISTRY } from "@/themes/registry";

const isKnownPlugin = (slug: string) => Object.hasOwn(PLUGIN_REGISTRY, slug);
const isKnownTheme = (slug: string) => Object.hasOwn(THEME_REGISTRY, slug);

/** Network-wide rules: which themes sites may use, which plugins run on every site. */

async function networkOfSite(siteId: string) {
  return prisma.site.findUnique({ where: { id: siteId }, select: { network: { select: { id: true, enabledThemes: true, networkPlugins: true } } } });
}

/** Slugs a site may activate, or null when the network allows every theme. */
export async function allowedThemeSlugs(siteId: string): Promise<Set<string> | null> {
  const row = await networkOfSite(siteId);
  const list = row?.network.enabledThemes ?? [];
  return list.length ? new Set(list) : null;
}

/** Plugins the network forces on for this site (only ones still shipped with the build). */
export async function networkPluginSlugs(siteId: string): Promise<string[]> {
  const row = await networkOfSite(siteId);
  return (row?.network.networkPlugins ?? []).filter(isKnownPlugin);
}

/** Restrict sites to these themes. An empty list lifts the restriction. */
export async function setEnabledThemes(networkId: string, slugs: string[]) {
  const unique = [...new Set(slugs)];
  const bad = unique.find((s) => !isKnownTheme(s));
  if (bad) throw new Error(`Unknown theme "${bad}"`);
  await prisma.network.update({ where: { id: networkId }, data: { enabledThemes: unique } });
}

/** Activate these plugins on every site of the network. Callers reload the loaded sites (`reloadPlugins`). */
export async function setNetworkPlugins(networkId: string, slugs: string[]) {
  const unique = [...new Set(slugs)];
  const bad = unique.find((s) => !isKnownPlugin(s));
  if (bad) throw new Error(`Unknown plugin "${bad}"`);
  await prisma.network.update({ where: { id: networkId }, data: { networkPlugins: unique } });
}
