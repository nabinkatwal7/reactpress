import { PageHeader } from "@/components/admin/page-header";
import { getDefaultNetwork } from "@/lib/network/sites";
import { THEME_REGISTRY } from "@/themes/registry";
import { ChecklistForm } from "../checklist-form";

export const instant = false;

export default async function NetworkThemesPage() {
  const network = await getDefaultNetwork();
  const items = Object.values(THEME_REGISTRY).map(({ manifest }) => ({
    slug: manifest.slug,
    name: `${manifest.name} v${manifest.version}`,
    description: manifest.description,
  }));
  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader title="Network themes" />
      <ChecklistForm
        items={items}
        initial={network.enabledThemes}
        endpoint="/api/network/themes"
        field="enabled"
        hint="Sites can only activate the checked themes. Leave everything unchecked to allow all themes. A site keeps the theme it already uses."
      />
    </main>
  );
}
