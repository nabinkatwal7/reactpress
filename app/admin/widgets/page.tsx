import { PageHeader } from "@/components/admin/page-header";
import { requireSiteId } from "@/lib/site";
import { listAreasWithWidgets, WIDGET_TYPES } from "@/lib/widgets";
import { WidgetsEditor } from "./widgets-editor";

export const instant = false;

export default async function WidgetsPage() {
  const areas = await listAreasWithWidgets(await requireSiteId());

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader title="Widgets" />
      <WidgetsEditor
        types={Object.entries(WIDGET_TYPES).map(([key, t]) => ({ key, label: t.label }))}
        areas={areas.map((a) => ({
          key: a.key,
          name: a.name,
          widgets: a.widgets.map((w) => ({
            id: w.id,
            type: w.type,
            settings: w.settings as Record<string, unknown>,
          })),
        }))}
      />
    </main>
  );
}
