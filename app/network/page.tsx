import { PageHeader } from "@/components/admin/page-header";
import { getDefaultNetwork, listSites } from "@/lib/network/sites";
import { SitesManager } from "./sites-manager";

export const instant = false;

export default async function NetworkSitesPage() {
  const network = await getDefaultNetwork();
  const sites = await listSites(network.id);
  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader title={`Sites in ${network.name}`} />
      <SitesManager
        sites={sites.map((s) => ({ id: s.id, name: s.name, slug: s.slug, domain: s.domain, isDefault: s.isDefault }))}
      />
    </main>
  );
}
