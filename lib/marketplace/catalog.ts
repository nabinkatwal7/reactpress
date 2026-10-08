import { safeFetch } from "@/lib/net/safe-fetch";
import { prisma } from "@/lib/prisma";
import { compareVersions, registrySchema, type Registry, type RegistryItem } from "./format";
import { isBundledPackage, readMarker } from "./packages";

const MAX_REGISTRY_BYTES = 1024 * 1024;
const CACHE_MS = 5 * 60_000;

const g = globalThis as unknown as { __rpRegistryCache?: Map<string, { at: number; registry: Registry }> };
const cache = (g.__rpRegistryCache ??= new Map());

export function clearRegistryCache() {
  cache.clear();
}

/** Fetch and validate one registry. Cached for a few minutes. Throws a readable error. */
export async function fetchRegistry(url: string, { fresh = false } = {}): Promise<Registry> {
  const hit = cache.get(url);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.registry;

  let body: Buffer;
  try {
    body = (await safeFetch(url, { maxBytes: MAX_REGISTRY_BYTES, accept: "application/json" })).body;
  } catch (e) {
    throw new Error(`Could not load ${url}: ${(e as Error).message}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(body.toString("utf8"));
  } catch {
    throw new Error(`${url} is not valid JSON`);
  }
  const parsed = registrySchema.safeParse(json);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    throw new Error(`${url} is not a ReactPress registry (${i.path.join(".") || "root"}: ${i.message})`);
  }
  cache.set(url, { at: Date.now(), registry: parsed.data });
  return parsed.data;
}

export type CatalogStatus = "available" | "installed" | "update" | "bundled";

export type CatalogItem = RegistryItem & {
  registry: string;
  registryName: string;
  status: CatalogStatus;
  installedVersion: string | null;
};

export type Catalog = { items: CatalogItem[]; errors: { registry: string; error: string }[] };

export function statusOf(item: Pick<RegistryItem, "type" | "slug" | "version">): { status: CatalogStatus; installedVersion: string | null } {
  if (isBundledPackage(item.type, item.slug)) return { status: "bundled", installedVersion: null };
  const marker = readMarker(item.type, item.slug);
  if (!marker) return { status: "available", installedVersion: null };
  return { status: compareVersions(item.version, marker.version) > 0 ? "update" : "installed", installedVersion: marker.version };
}

/** Everything the network's registries offer, with what is already on this server. Failing registries are reported, not fatal. */
export async function loadCatalog(networkId: string, opts: { fresh?: boolean } = {}): Promise<Catalog> {
  const network = await prisma.network.findUniqueOrThrow({ where: { id: networkId }, select: { registries: true } });
  const results = await Promise.allSettled(network.registries.map((url) => fetchRegistry(url, opts)));
  const items: CatalogItem[] = [];
  const errors: Catalog["errors"] = [];
  results.forEach((r, i) => {
    const url = network.registries[i];
    if (r.status === "rejected") return void errors.push({ registry: url, error: (r.reason as Error).message });
    for (const item of r.value.items) items.push({ ...item, registry: url, registryName: r.value.name, ...statusOf(item) });
  });
  return { items, errors };
}

/** Find one catalog entry by registry + type + slug. The server never trusts a download URL from the client. */
export async function findCatalogItem(networkId: string, registry: string, type: string, slug: string): Promise<CatalogItem | null> {
  const network = await prisma.network.findUniqueOrThrow({ where: { id: networkId }, select: { registries: true } });
  if (!network.registries.includes(registry)) return null;
  const reg = await fetchRegistry(registry);
  const item = reg.items.find((i) => i.type === type && i.slug === slug);
  return item ? { ...item, registry, registryName: reg.name, ...statusOf(item) } : null;
}
