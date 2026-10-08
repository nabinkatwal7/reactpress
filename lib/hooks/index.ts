import { createHookBus, type HookBus } from "./bus";

export { createHookBus, DEFAULT_PRIORITY, type HookBus } from "./bus";

/**
 * One bus per site: plugins are activated per site, so their handlers must not leak across sites.
 * Kept on globalThis so dev hot reloads keep one instance. Core code normally calls
 * `doAction` / `applyFilters` below; plugins get a bus-bound version through the plugin API.
 */
const g = globalThis as unknown as { __rpHookBuses?: Map<string, HookBus> };
const buses = (g.__rpHookBuses ??= new Map());

export function getHookBus(siteId: string): HookBus {
  let bus = buses.get(siteId);
  if (!bus) buses.set(siteId, (bus = createHookBus()));
  return bus;
}

/** Throw away a site's bus (all handlers). The plugin loader rebuilds it from the active plugins. */
export function resetHookBus(siteId: string) {
  buses.delete(siteId);
}

export const doAction = (siteId: string, name: string, ...args: unknown[]) =>
  getHookBus(siteId).doAction(name, ...args);

export const applyFilters = <T>(siteId: string, name: string, value: T, ...args: unknown[]) =>
  getHookBus(siteId).applyFilters(name, value, ...args);
