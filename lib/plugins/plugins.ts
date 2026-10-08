import path from "node:path";
import { prisma } from "@/lib/prisma";
import { PLUGIN_REGISTRY } from "@/plugins/registry";
import { reloadPlugins } from "./loader";
import { PLUGINS_DIR, validatePluginDir, type PluginManifest } from "./manifest";

export type PluginListing = {
  manifest: PluginManifest;
  installed: boolean;
  active: boolean;
};

export function isKnownPlugin(slug: string) {
  return Object.hasOwn(PLUGIN_REGISTRY, slug);
}

export async function listPlugins(siteId: string): Promise<PluginListing[]> {
  const rows = await prisma.pluginInstall.findMany({ where: { siteId } });
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  return Object.values(PLUGIN_REGISTRY).map(({ manifest }) => {
    const row = bySlug.get(manifest.slug);
    return { manifest, installed: !!row, active: !!row?.active };
  });
}

/** Install = record it for the site after checking the package on disk. Inactive until activated. */
export async function installPlugin(siteId: string, slug: string) {
  if (!isKnownPlugin(slug)) throw new Error("Unknown plugin");
  const check = validatePluginDir(path.join(PLUGINS_DIR, slug));
  if (!check.ok) throw new Error(`Plugin is invalid: ${check.issues.join("; ")}`);
  return prisma.pluginInstall.upsert({
    where: { siteId_slug: { siteId, slug } },
    update: { version: check.manifest.version },
    create: { siteId, slug, version: check.manifest.version },
  });
}

export async function activatePlugin(siteId: string, slug: string) {
  await installPlugin(siteId, slug); // activating an uninstalled plugin installs it first
  await prisma.pluginInstall.update({ where: { siteId_slug: { siteId, slug } }, data: { active: true } });
  await reloadPlugins(siteId);
}

export async function deactivatePlugin(siteId: string, slug: string) {
  const res = await prisma.pluginInstall.updateMany({ where: { siteId, slug }, data: { active: false } });
  await reloadPlugins(siteId);
  return res.count > 0;
}

/** Delete = remove the install and its settings. Active plugins must be deactivated first. */
export async function deletePlugin(siteId: string, slug: string) {
  const row = await prisma.pluginInstall.findUnique({ where: { siteId_slug: { siteId, slug } } });
  if (!row) return false;
  if (row.active) throw new Error("Deactivate the plugin before deleting it");
  await prisma.pluginInstall.delete({ where: { id: row.id } });
  return true;
}

/** Sidebar entries for the admin pages of the site's active plugins. */
export async function activePluginPages(siteId: string): Promise<{ href: string; label: string }[]> {
  const rows = await prisma.pluginInstall.findMany({ where: { siteId, active: true }, orderBy: { installedAt: "asc" } });
  return rows.flatMap(({ slug }) =>
    Object.hasOwn(PLUGIN_REGISTRY, slug)
      ? PLUGIN_REGISTRY[slug].manifest.adminPages.map((p) => ({ href: `/admin/plugins/${slug}/${p.slug}`, label: p.title }))
      : [],
  );
}
