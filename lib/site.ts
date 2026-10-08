import { headers } from "next/headers";
import { cache } from "react";
import type { Site } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Header values set by proxy.ts. Outside a request (scripts, tests) there are none. */
async function proxyHeader(name: string): Promise<string | null> {
  try {
    return (await headers()).get(name);
  } catch {
    return null;
  }
}

/**
 * Resolve the current site for this request: the one proxy.ts picked (custom domain, `/site-slug`
 * path, or the admin's selected site), else the default site, else the first site.
 * Cached per request via React cache().
 */
export const resolveSite = cache(async (): Promise<Site> => {
  const id = await proxyHeader("x-rp-site");
  const picked = id ? await prisma.site.findUnique({ where: { id } }) : null;
  const site =
    picked ??
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

/** "" normally, "/slug" when the site is served under a path prefix. Prefix internal links with it. */
export async function siteBasePath(): Promise<string> {
  return (await proxyHeader("x-rp-base")) ?? "";
}

/** Merge siteId into a Prisma where clause so content queries stay scoped. */
export function withSiteId<T extends object>(
  siteId: string,
  where?: T,
): T & { siteId: string } {
  return { ...(where ?? ({} as T)), siteId };
}
