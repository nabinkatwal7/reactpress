import type { HookBus } from "@/lib/hooks";
import { registerAdminPage, type AdminPageComponent } from "./admin-pages";
import type { PluginManifest } from "./manifest";
import { getPluginSettings, type SettingValues } from "./settings";

/**
 * The only surface a plugin gets. `register(api)` is called once per site when the plugin is
 * active; handlers added here are tagged with the plugin's slug and removed on deactivate.
 */
export type PluginApi = {
  siteId: string;
  slug: string;
  addAction(name: string, fn: (...args: never[]) => void | Promise<void>, priority?: number): void;
  addFilter<T>(name: string, fn: (value: T, ...args: never[]) => T | Promise<T>, priority?: number): void;
  /** Current values of the settings declared in plugin.json (defaults filled in). Call inside handlers, not at register time. */
  getSettings(): Promise<SettingValues>;
  /** Supply the component for an admin page declared in plugin.json `adminPages`. */
  registerAdminPage(page: string, component: AdminPageComponent): void;
};

export function createPluginApi(siteId: string, manifest: PluginManifest, bus: HookBus): PluginApi {
  const slug = manifest.slug;
  return {
    siteId,
    slug,
    addAction: (name, fn, priority) => bus.addAction(name, fn, { priority, owner: slug }),
    addFilter: (name, fn, priority) => bus.addFilter(name, fn, { priority, owner: slug }),
    getSettings: () => getPluginSettings(siteId, manifest),
    registerAdminPage(page, component) {
      if (!manifest.adminPages.some((p) => p.slug === page)) {
        throw new Error(`Admin page "${page}" is not declared in plugin.json`);
      }
      registerAdminPage(siteId, slug, page, component);
    },
  };
}
