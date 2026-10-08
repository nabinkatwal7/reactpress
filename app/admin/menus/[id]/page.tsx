import { PageHeader } from "@/components/admin/page-header";
import { getMenu, getMenuItemsFlat, MENU_LOCATIONS } from "@/lib/menus";
import { prisma } from "@/lib/prisma";
import { requireSiteId } from "@/lib/site";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MenuEditor } from "./menu-editor";

export const instant = false;

type Props = { params: Promise<{ id: string }> };

export default async function EditMenuPage({ params }: Props) {
  const { id } = await params;
  const siteId = await requireSiteId();
  const menu = await getMenu(siteId, id);
  if (!menu) notFound();

  const [items, posts, pages] = await Promise.all([
    getMenuItemsFlat(id),
    prisma.post.findMany({
      where: { siteId, type: "post", status: "publish" },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.page.findMany({
      where: { siteId, status: "publish" },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  const assigned = Object.fromEntries(
    (
      await prisma.menuLocation.findMany({ where: { siteId } })
    ).map((l) => [l.location, l.menuId]),
  );

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader back={{ href: "/admin/menus", label: "Menus" }} title={<>{menu.name}</>} />
      <MenuEditor
        menuId={menu.id}
        initialName={menu.name}
        initialItems={items}
        posts={posts}
        pages={pages}
        locations={MENU_LOCATIONS.map((l) => ({
          ...l,
          current: assigned[l.key] ?? null,
        }))}
      />
    </main>
  );
}
