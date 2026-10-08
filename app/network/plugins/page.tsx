import { PageHeader } from "@/components/admin/page-header";
import { getDefaultNetwork } from "@/lib/network/sites";
import { PLUGIN_REGISTRY } from "@/plugins/registry";
import { ChecklistForm } from "../checklist-form";

export const instant = false;

export default async function NetworkPluginsPage() {
  const network = await getDefaultNetwork();
  const items = Object.values(PLUGIN_REGISTRY).map(({ manifest }) => ({
    slug: manifest.slug,
    name: `${manifest.name} v${manifest.version}`,
    description: manifest.description,
  }));
  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader title="Network plugins" />
      <ChecklistForm
        items={items}
        initial={network.networkPlugins}
        endpoint="/api/network/plugins"
        field="plugins"
        hint="Checked plugins run on every site in the network. Sites cannot deactivate them but keep their own plugin settings."
      />
    </main>
  );
}
