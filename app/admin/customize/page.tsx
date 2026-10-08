import { PageHeader } from "@/components/admin/page-header";
import { listMenus } from "@/lib/menus";
import { prisma } from "@/lib/prisma";
import { requireSiteId } from "@/lib/site";
import { getDraft, getLiveValues } from "@/lib/theme/customizer";
import { getActiveThemeSlug, loadTheme } from "@/lib/theme/themes";
import { CustomizerClient } from "./customizer-client";

export const instant = false;

export default async function CustomizePage() {
  const siteId = await requireSiteId();
  const { manifest } = await loadTheme(await getActiveThemeSlug(siteId));
  const [live, draft, menus, pages] = await Promise.all([
    getLiveValues(siteId, manifest),
    getDraft(siteId, manifest),
    listMenus(siteId),
    prisma.page.findMany({
      where: { siteId, status: "publish" },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-4 p-8">
      <PageHeader title={`Customize — ${manifest.name}`} />
      <CustomizerClient
        settings={manifest.customizer.settings}
        live={live}
        initialDraft={draft}
        menus={menus.map((m) => ({ id: m.id, name: m.name }))}
        pages={pages}
      />
    </main>
  );
}
