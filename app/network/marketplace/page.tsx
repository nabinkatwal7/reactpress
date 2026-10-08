import { PageHeader } from "@/components/admin/page-header";
import { loadCatalog } from "@/lib/marketplace/catalog";
import { getDefaultNetwork } from "@/lib/network/sites";
import { MarketplaceBrowser } from "./marketplace-browser";

export const instant = false;

export default async function MarketplacePage() {
  const network = await getDefaultNetwork();
  const catalog = await loadCatalog(network.id);
  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader title="Marketplace" />
      <MarketplaceBrowser registries={network.registries} items={catalog.items} errors={catalog.errors} />
    </main>
  );
}
