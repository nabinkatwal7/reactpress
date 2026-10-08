/**
 * Actions / filters bus (WordPress-style). Actions run for side effects; filters pass a value
 * through every handler in priority order. Handlers may be async. A throwing handler is logged
 * and skipped so one bad plugin cannot take the site down.
 */

export const DEFAULT_PRIORITY = 10;

type Fn = (...args: never[]) => unknown;
type Handler = { fn: Fn; priority: number; owner: string; seq: number };
type AddOptions = { priority?: number; owner?: string };

export type HookBus = ReturnType<typeof createHookBus>;

export function createHookBus() {
  const actions = new Map<string, Handler[]>();
  const filters = new Map<string, Handler[]>();
  let seq = 0;

  function add(store: Map<string, Handler[]>, name: string, fn: Fn, opts: AddOptions) {
    const list = store.get(name) ?? [];
    list.push({ fn, priority: opts.priority ?? DEFAULT_PRIORITY, owner: opts.owner ?? "core", seq: seq++ });
    // lower priority runs first; ties keep registration order
    list.sort((a, b) => a.priority - b.priority || a.seq - b.seq);
    store.set(name, list);
  }

  function remove(store: Map<string, Handler[]>, name: string, fn: Fn) {
    const list = store.get(name) ?? [];
    const next = list.filter((h) => h.fn !== fn);
    if (next.length) store.set(name, next);
    else store.delete(name);
    return next.length !== list.length;
  }

  function report(kind: string, name: string, h: Handler, e: unknown) {
    console.error(`[hooks] ${kind} "${name}" handler from "${h.owner}" threw:`, e);
  }

  return {
    addAction(name: string, fn: (...args: never[]) => void | Promise<void>, opts: AddOptions = {}) {
      add(actions, name, fn, opts);
    },
    addFilter<T>(name: string, fn: (value: T, ...args: never[]) => T | Promise<T>, opts: AddOptions = {}) {
      add(filters, name, fn as Fn, opts);
    },
    removeAction: (name: string, fn: Fn) => remove(actions, name, fn),
    removeFilter: (name: string, fn: Fn) => remove(filters, name, fn),
    hasAction: (name: string) => (actions.get(name)?.length ?? 0) > 0,
    hasFilter: (name: string) => (filters.get(name)?.length ?? 0) > 0,

    async doAction(name: string, ...args: unknown[]): Promise<void> {
      for (const h of [...(actions.get(name) ?? [])]) {
        try {
          await (h.fn as (...a: unknown[]) => unknown)(...args);
        } catch (e) {
          report("action", name, h, e);
        }
      }
    },

    async applyFilters<T>(name: string, value: T, ...args: unknown[]): Promise<T> {
      let current = value;
      for (const h of [...(filters.get(name) ?? [])]) {
        try {
          current = (await (h.fn as (...a: unknown[]) => unknown)(current, ...args)) as T;
        } catch (e) {
          report("filter", name, h, e);
        }
      }
      return current;
    },

    /** Drop every handler a plugin registered (used on deactivate). */
    removeOwner(owner: string) {
      for (const store of [actions, filters]) {
        for (const [name, list] of store) {
          const next = list.filter((h) => h.owner !== owner);
          if (next.length) store.set(name, next);
          else store.delete(name);
        }
      }
    },
  };
}
