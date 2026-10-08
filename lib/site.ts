import { cache } from "react";
import type { Site } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Resolve the current site for this request.
 * Single-site first: default site, else first site.
 * Cached per request via React cache().
 */
export const resolveSite = cache(async (): Promise<Site> => {
  const site =
    (await prisma.site.findFirst({ where: { isDefault: true } })) ??
    (await prisma.site.findFirst({ orderBy: { createdAt: "asc" } }));

  if (!site) {
    throw new Error("No site found. Run npm run db:seed.");
  }

  return site;
});

export async function requireSiteId(): Promise<string> {
  return (await resolveSite()).id;
}

/** Merge siteId into a Prisma where clause so content queries stay scoped. */
export function withSiteId<T extends object>(
  siteId: string,
  where?: T,
): T & { siteId: string } {
  return { ...(where ?? ({} as T)), siteId };
}
