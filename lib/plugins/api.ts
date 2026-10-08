import type { HookBus } from "@/lib/hooks";

/**
 * The only surface a plugin gets. `register(api)` is called once per site when the plugin is
 * active; handlers added here are tagged with the plugin's slug and removed on deactivate.
 */
export type PluginApi = {
  siteId: string;
  slug: string;
  addAction(name: string, fn: (...args: never[]) => void | Promise<void>, priority?: number): void;
  addFilter<T>(name: string, fn: (value: T, ...args: never[]) => T | Promise<T>, priority?: number): void;
};

export function createPluginApi(siteId: string, slug: string, bus: HookBus): PluginApi {
  return {
    siteId,
    slug,
    addAction: (name, fn, priority) => bus.addAction(name, fn, { priority, owner: slug }),
    addFilter: (name, fn, priority) => bus.addFilter(name, fn, { priority, owner: slug }),
  };
}
