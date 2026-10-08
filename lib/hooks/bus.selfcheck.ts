/** ponytail: run with `npx tsx lib/hooks/bus.selfcheck.ts` */
import { createHookBus } from "./bus";
import { getHookBus, resetHookBus } from "./index";

async function main() {
  const bus = createHookBus();

  const order: string[] = [];
  bus.addAction("boot", () => void order.push("late"), { priority: 20 });
  bus.addAction("boot", () => void order.push("first"), { priority: 1 });
  bus.addAction("boot", async () => { await Promise.resolve(); order.push("mid-a"); });
  bus.addAction("boot", () => void order.push("mid-b"));
  await bus.doAction("boot");
  console.assert(order.join() === "first,mid-a,mid-b,late", "priority then registration order");

  const seen: unknown[] = [];
  bus.addAction("args", (...a: unknown[]) => void seen.push(...a));
  await bus.doAction("args", 1, "two");
  console.assert(seen.join() === "1,two", "action receives args");

  bus.addFilter<string>("title", (v) => v + "!");
  bus.addFilter<string>("title", async (v) => v.toUpperCase(), { priority: 5 });
  console.assert((await bus.applyFilters("title", "hi")) === "HI!", "filters chain in priority order");
  console.assert((await bus.applyFilters("none", "x")) === "x", "no handlers returns value");

  const extra: unknown[] = [];
  bus.addFilter<number>("sum", (v, ...rest: never[]) => (extra.push(...rest), v));
  await bus.applyFilters("sum", 1, "a", "b");
  console.assert(extra.join() === "a,b", "filter receives extra args");

  // a throwing handler is skipped, value flows on
  const origError = console.error;
  console.error = () => {};
  bus.addFilter<string>("bad", () => { throw new Error("boom"); });
  bus.addFilter<string>("bad", (v) => v + "ok");
  bus.addAction("bad", () => { throw new Error("boom"); });
  console.assert((await bus.applyFilters("bad", "x")) === "xok", "throwing filter is skipped");
  await bus.doAction("bad");
  console.error = origError;

  // removal
  const fn = () => void order.push("never");
  bus.addAction("rm", fn);
  console.assert(bus.hasAction("rm") && bus.removeAction("rm", fn) && !bus.hasAction("rm"), "removeAction");

  bus.addFilter<string>("own", (v) => v + "A", { owner: "plugin-a" });
  bus.addFilter<string>("own", (v) => v + "B", { owner: "plugin-b" });
  bus.addAction("own", () => void order.push("a"), { owner: "plugin-a" });
  bus.removeOwner("plugin-a");
  console.assert((await bus.applyFilters("own", "x")) === "xB", "removeOwner drops that plugin's filters");
  console.assert(!bus.hasAction("own"), "removeOwner drops that plugin's actions");

  // per-site isolation
  getHookBus("site-1").addFilter<string>("t", (v) => v + "1");
  console.assert((await getHookBus("site-2").applyFilters("t", "x")) === "x", "buses are per site");
  console.assert(getHookBus("site-1") === getHookBus("site-1"), "bus is stable per site");
  resetHookBus("site-1");
  console.assert((await getHookBus("site-1").applyFilters("t", "x")) === "x", "reset clears handlers");

  console.log("hooks self-check passed");
}

main();
