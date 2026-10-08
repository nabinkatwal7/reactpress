import { PageHeader } from "@/components/admin/page-header";
import { prisma } from "@/lib/prisma";
import { POST_BASES, loadSettings } from "@/lib/settings";
import { requireSiteId } from "@/lib/site";
import { SettingsForm } from "./settings-form";

export const instant = false;

export default async function SettingsPage() {
  const siteId = await requireSiteId();
  const [settings, pages] = await Promise.all([
    loadSettings(siteId),
    prisma.page.findMany({
      where: { siteId, status: "publish" },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader title="Settings" />
      <SettingsForm initial={settings} pages={pages} postBases={[...POST_BASES]} />
    </main>
  );
}
