import { rm, unlink } from "node:fs/promises";
import path from "node:path";
import type { Network, Site } from "@prisma/client";
import { STORAGE_ROOT, absolutePath } from "@/lib/media";
import { prisma } from "@/lib/prisma";
import { RESERVED_KEYS } from "@/lib/registry";
import { getSettings } from "@/lib/settings";
import { invalidateSiteIndex } from "./site-index";

/**
 * Networks and the sites under them. A network groups sites that share users; each site has its
 * own content, media, menus, settings, themes and plugins (everything keyed by `siteId`).
 */

export const SITE_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

/** First URL segments that already mean something, so a site's `/<slug>` path can never shadow them. */
export const RESERVED_SITE_SLUGS = new Set([
  "admin",
  "api",
  "login",
  "logout",
  "network",
  "search",
  "media",
  "theme-assets",
  "favicon",
  "robots",
  "sitemap",
  "static",
  "public",
  "_next",
  ...RESERVED_KEYS,
]);

export type SiteInput = { name: string; slug: string; domain?: string | null };

export function normalizeDomain(raw: string | null | undefined): string | null {
  const d = raw?.trim().toLowerCase().replace(/\.$/, "");
  return d ? d : null;
}

export async function getDefaultNetwork(): Promise<Network> {
  const net = await prisma.network.findFirst({ orderBy: { createdAt: "asc" } });
  if (!net) throw new Error("No network found. Run npm run db:seed.");
  return net;
}

export async function listSites(networkId: string): Promise<Site[]> {
  return prisma.site.findMany({ where: { networkId }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
}

/** Everything that would make `/<slug>` ambiguous on the network's default site. Returns a reason or null. */
async function pathConflict(networkId: string, slug: string): Promise<string | null> {
  if (RESERVED_SITE_SLUGS.has(slug)) return `"${slug}" is reserved`;
  const root = await prisma.site.findFirst({ where: { networkId, isDefault: true } });
  if (!root) return null;
  const [page, taxonomy, settings] = await Promise.all([
    prisma.page.findFirst({ where: { siteId: root.id, slug }, select: { id: true } }),
    prisma.taxonomy.findFirst({ where: { siteId: root.id, key: slug }, select: { id: true } }),
    getSettings(root.id),
  ]);
  if (page) return `"${slug}" is already a page on the main site`;
  if (taxonomy || settings.post_base === slug) return `"${slug}" is already used by the main site's URLs`;
  return null;
}

async function validate(networkId: string, input: SiteInput, existing?: Site) {
  const name = input.name?.trim();
  if (!name || name.length > 100) throw new Error("Site name is required (max 100 characters)");
  const slug = input.slug?.trim().toLowerCase();
  if (!slug || !SITE_SLUG.test(slug)) throw new Error("Slug must be 1-40 characters: lowercase letters, digits and dashes");
  const domain = normalizeDomain(input.domain);
  if (domain && !HOSTNAME.test(domain)) throw new Error("Domain must be a hostname such as blog.example.com (no port or path)");

  if (!existing || existing.slug !== slug) {
    const conflict = await pathConflict(networkId, slug);
    if (conflict) throw new Error(conflict);
    if (await prisma.site.findUnique({ where: { slug } })) throw new Error(`The slug "${slug}" is taken`);
  }
  if (domain && domain !== existing?.domain && (await prisma.site.findUnique({ where: { domain } }))) {
    throw new Error(`The domain "${domain}" is already mapped to a site`);
  }
  return { name, slug, domain };
}

/** Create a site in a network. `adminUserId` (the creator) becomes its administrator. Content tables fill lazily. */
export async function createSite(networkId: string, input: SiteInput, adminUserId?: string): Promise<Site> {
  if (!(await prisma.network.findUnique({ where: { id: networkId }, select: { id: true } }))) {
    throw new Error("Network not found");
  }
  const data = await validate(networkId, input);
  const adminRole = adminUserId ? await prisma.role.findUnique({ where: { key: "administrator" } }) : null;
  const created = await prisma.site.create({
    data: {
      ...data,
      networkId,
      ...(adminUserId && adminRole ? { members: { create: { userId: adminUserId, roleId: adminRole.id } } } : {}),
    },
  });
  invalidateSiteIndex();
  return created;
}

export async function updateSite(siteId: string, input: SiteInput): Promise<Site> {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw new Error("Site not found");
  // the default site keeps its slug: it is the fallback everything else resolves to
  const data = await validate(site.networkId, site.isDefault ? { ...input, slug: site.slug } : input, site);
  const updated = await prisma.site.update({ where: { id: siteId }, data });
  invalidateSiteIndex();
  return updated;
}

/** Delete a site and everything under it (rows cascade; media and plugin files are removed from disk). */
export async function deleteSite(siteId: string): Promise<boolean> {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) return false;
  if (site.isDefault) throw new Error("The default site cannot be deleted");

  const media = await prisma.media.findMany({ where: { siteId }, select: { path: true } });
  await prisma.site.delete({ where: { id: siteId } });
  invalidateSiteIndex();
  await Promise.all(media.map((m) => unlink(absolutePath(m.path)).catch(() => {})));
  await rm(path.join(STORAGE_ROOT, "plugin-data", siteId), { recursive: true, force: true });
  return true;
}
