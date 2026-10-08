import type { HookBus } from "@/lib/hooks";
import { prisma } from "@/lib/prisma";
import { registerAdminPage, type AdminPageComponent } from "./admin-pages";
import type { PluginManifest } from "./manifest";
import { createPluginFiles, pluginFileRoot, type PluginFiles } from "./sandbox";
import { getPluginSettings, type SettingValues } from "./settings";
import { createPluginStore, type PluginStore } from "./store";

/** What a plugin entry module default-exports. */
export type PluginRegister = (api: PluginApi) => void | Promise<void>;

export type PostSummary = { id: string; title: string; slug: string; publishedAt: Date | null };

/**
 * The only surface a plugin gets. `register(api)` is called once per site when the plugin is
 * active; handlers added here are tagged with the plugin's slug and removed on deactivate.
 * Data and files are reachable only through this object (see sandbox.ts for the rules).
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
  /** Private JSON key/value storage for this plugin on this site. */
  store: PluginStore;
  /** Files confined to this plugin's own folder inside the upload dir. Relative paths like "reports/a.json" only. */
  files: PluginFiles;
  /** Read-only view of the site's published posts (newest first, max 100). */
  posts: { list(opts?: { limit?: number }): Promise<PostSummary[]> };
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
    store: createPluginStore(siteId, slug),
    files: createPluginFiles(pluginFileRoot(siteId, slug)),
    posts: {
      list: ({ limit = 20 } = {}) =>
        prisma.post.findMany({
          where: { siteId, type: "post", status: "publish" },
          select: { id: true, title: true, slug: true, publishedAt: true },
          orderBy: { publishedAt: "desc" },
          take: Math.min(Math.max(Math.trunc(limit) || 1, 1), 100),
        }),
    },
  };
}
