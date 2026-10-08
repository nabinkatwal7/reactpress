import { prisma } from "@/lib/prisma";
import { withSiteId } from "@/lib/site";
import type { MenuItemInput } from "@/lib/validations/menu";

/** Theme-facing menu locations. Themes/plugins will register more later. */
export const MENU_LOCATIONS = [
  { key: "primary", label: "Primary navigation" },
  { key: "footer", label: "Footer" },
] as const;

export function isMenuLocation(key: string) {
  return MENU_LOCATIONS.some((l) => l.key === key);
}

export async function listMenus(siteId: string) {
  return prisma.menu.findMany({
    where: withSiteId(siteId),
    orderBy: { name: "asc" },
    include: { locations: true, _count: { select: { items: true } } },
  });
}

export async function getMenu(siteId: string, id: string) {
  return prisma.menu.findFirst({
    where: withSiteId(siteId, { id }),
    include: { locations: true },
  });
}

export async function createMenu(siteId: string, name: string) {
  return prisma.menu.create({ data: { siteId, name } });
}

export async function renameMenu(siteId: string, id: string, name: string) {
  const res = await prisma.menu.updateMany({ where: withSiteId(siteId, { id }), data: { name } });
  return res.count > 0;
}

export async function deleteMenu(siteId: string, id: string) {
  const res = await prisma.menu.deleteMany({ where: withSiteId(siteId, { id }) });
  return res.count > 0;
}

export type EditorItem = MenuItemInput & { id: string };

/** Items as a flat, ordered list with depth (what the editor works with). */
export async function getMenuItemsFlat(menuId: string): Promise<EditorItem[]> {
  const rows = await prisma.menuItem.findMany({
    where: { menuId },
    orderBy: { position: "asc" },
  });
  const byParent = new Map<string | null, typeof rows>();
  for (const r of rows) {
    const list = byParent.get(r.parentId) ?? [];
    list.push(r);
    byParent.set(r.parentId, list);
  }
  const out: EditorItem[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const r of byParent.get(parentId) ?? []) {
      out.push({
        id: r.id,
        label: r.label,
        objectType: r.objectType as EditorItem["objectType"],
        objectId: r.objectId,
        url: r.url,
        depth,
      });
      walk(r.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** Replace the whole item list. Targets must belong to this site. */
export async function saveMenuItems(siteId: string, menuId: string, items: MenuItemInput[]) {
  const menu = await getMenu(siteId, menuId);
  if (!menu) return false;

  const postIds = items.filter((i) => i.objectType === "post").map((i) => i.objectId!);
  const pageIds = items.filter((i) => i.objectType === "page").map((i) => i.objectId!);
  const [posts, pages] = await Promise.all([
    prisma.post.count({ where: { siteId, id: { in: postIds } } }),
    prisma.page.count({ where: { siteId, id: { in: pageIds } } }),
  ]);
  if (posts !== new Set(postIds).size || pages !== new Set(pageIds).size) {
    throw new Error("Menu item target not found");
  }

  await prisma.$transaction(async (tx) => {
    await tx.menuItem.deleteMany({ where: { menuId } });
    const stack: string[] = []; // id of the last item at each depth
    for (const [position, item] of items.entries()) {
      const created = await tx.menuItem.create({
        data: {
          menuId,
          parentId: item.depth > 0 ? stack[item.depth - 1] : null,
          label: item.label,
          objectType: item.objectType,
          objectId: item.objectType === "custom" ? null : item.objectId,
          url: item.objectType === "custom" ? item.url : null,
          position,
        },
      });
      stack[item.depth] = created.id;
      stack.length = item.depth + 1;
    }
  });
  return true;
}

export async function setMenuLocation(siteId: string, location: string, menuId: string | null) {
  if (!isMenuLocation(location)) throw new Error("Unknown location");
  if (menuId === null) {
    await prisma.menuLocation.deleteMany({ where: { siteId, location } });
    return;
  }
  if (!(await getMenu(siteId, menuId))) throw new Error("Menu not found");
  await prisma.menuLocation.upsert({
    where: { siteId_location: { siteId, location } },
    update: { menuId },
    create: { siteId, location, menuId },
  });
}

export type ResolvedMenuItem = { id: string; label: string; href: string; children: ResolvedMenuItem[] };

/** Menu assigned to a location, with links resolved and unpublished targets dropped (for themes). */
export async function getMenuForLocation(siteId: string, location: string): Promise<ResolvedMenuItem[]> {
  const assignment = await prisma.menuLocation.findUnique({
    where: { siteId_location: { siteId, location } },
  });
  if (!assignment) return [];

  const rows = await prisma.menuItem.findMany({
    where: { menuId: assignment.menuId },
    orderBy: { position: "asc" },
  });
  const [posts, pages] = await Promise.all([
    prisma.post.findMany({
      where: { siteId, status: "publish", id: { in: rows.filter((r) => r.objectType === "post").map((r) => r.objectId!) } },
      select: { id: true, slug: true },
    }),
    prisma.page.findMany({
      where: { siteId, status: "publish", id: { in: rows.filter((r) => r.objectType === "page").map((r) => r.objectId!) } },
      select: { id: true, slug: true },
    }),
  ]);
  const postSlug = new Map(posts.map((p) => [p.id, p.slug]));
  const pageSlug = new Map(pages.map((p) => [p.id, p.slug]));

  const nodes = new Map<string, ResolvedMenuItem>();
  const roots: ResolvedMenuItem[] = [];
  for (const r of rows) {
    let href: string | null = null;
    if (r.objectType === "custom") href = r.url;
    else if (r.objectType === "post" && postSlug.has(r.objectId!)) href = `/posts/${postSlug.get(r.objectId!)}`;
    else if (r.objectType === "page" && pageSlug.has(r.objectId!)) href = `/${pageSlug.get(r.objectId!)}`;
    if (!href) continue;

    const node: ResolvedMenuItem = { id: r.id, label: r.label, href, children: [] };
    nodes.set(r.id, node);
    const parent = r.parentId ? nodes.get(r.parentId) : null;
    if (parent) parent.children.push(node);
    else if (!r.parentId) roots.push(node);
  }
  return roots;
}
