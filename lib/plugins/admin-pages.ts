import type { ReactNode } from "react";
import type { SettingValues } from "./settings";

/** A plugin admin page is a server component; it is handed the site and the plugin's settings. */
export type AdminPageProps = { siteId: string; settings: SettingValues };
export type AdminPageComponent = (props: AdminPageProps) => ReactNode | Promise<ReactNode>;

/** Per-site registry, filled by `api.registerAdminPage` during boot and cleared on reload. */
const g = globalThis as unknown as { __rpAdminPages?: Map<string, Map<string, AdminPageComponent>> };
const bySite = (g.__rpAdminPages ??= new Map());

const key = (plugin: string, page: string) => `${plugin}/${page}`;

export function resetAdminPages(siteId: string) {
  bySite.delete(siteId);
}

export function registerAdminPage(siteId: string, plugin: string, page: string, component: AdminPageComponent) {
  let pages = bySite.get(siteId);
  if (!pages) bySite.set(siteId, (pages = new Map()));
  pages.set(key(plugin, page), component);
}

export function getAdminPage(siteId: string, plugin: string, page: string) {
  return bySite.get(siteId)?.get(key(plugin, page)) ?? null;
}

/** Drop every page a plugin registered (used when its register() fails half-way). */
export function removeAdminPages(siteId: string, plugin: string) {
  const pages = bySite.get(siteId);
  if (!pages) return;
  for (const k of [...pages.keys()]) if (k.startsWith(`${plugin}/`)) pages.delete(k);
}
