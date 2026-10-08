import { PageHeader } from "@/components/admin/page-header";
import { loadCatalog } from "@/lib/marketplace/catalog";
import { listInstalledPackages } from "@/lib/marketplace/packages";
import { getDefaultNetwork } from "@/lib/network/sites";
import { resolveSite } from "@/lib/site";
import { MarketplaceBrowser } from "./marketplace-browser";

export const instant = false;

export default async function MarketplacePage() {
  const network = await getDefaultNetwork();
  const [catalog, site] = await Promise.all([loadCatalog(network.id), resolveSite()]);
  const installed = [...listInstalledPackages("theme"), ...listInstalledPackages("plugin")];
  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader title="Marketplace" />
      <MarketplaceBrowser
        registries={network.registries}
        items={catalog.items}
        errors={catalog.errors}
        installed={installed.map((m) => ({ type: m.type, slug: m.slug, version: m.version }))}
        siteName={site.name}
        fileModsAllowed={process.env.REACTPRESS_DISALLOW_FILE_MODS !== "1"}
      />
    </main>
  );
}
