import { prisma } from "@/lib/prisma";
import type { SiteRef } from "./resolve";

/**
 * The (small) list of sites the proxy resolves requests against. Cached in memory for a few
 * seconds so it is not one query per request; site changes made in this process invalidate it,
 * other processes pick them up when the cache expires.
 */
const TTL_MS = 10_000;
const g = globalThis as unknown as { __rpSiteIndex?: { at: number; data: SiteRef[] } };

export async function loadSiteIndex(): Promise<SiteRef[]> {
  const hit = g.__rpSiteIndex;
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const data = await prisma.site.findMany({ select: { id: true, slug: true, domain: true, isDefault: true } });
  g.__rpSiteIndex = { at: Date.now(), data };
  return data;
}

export function invalidateSiteIndex() {
  g.__rpSiteIndex = undefined;
}
