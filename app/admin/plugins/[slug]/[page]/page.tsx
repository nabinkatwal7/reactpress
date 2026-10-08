import { PageHeader } from "@/components/admin/page-header";
import { getAdminPage } from "@/lib/plugins/admin-pages";
import { ensurePluginsLoaded } from "@/lib/plugins/loader";
import { isKnownPlugin } from "@/lib/plugins/plugins";
import { getPluginSettings } from "@/lib/plugins/settings";
import { requireSiteId } from "@/lib/site";
import { PLUGIN_REGISTRY } from "@/plugins/registry";
import { notFound } from "next/navigation";

export const instant = false;

type Props = { params: Promise<{ slug: string; page: string }> };

/** Renders an admin page a plugin registered. Only active plugins have pages. */
export default async function PluginAdminPage({ params }: Props) {
  const { slug, page } = await params;
  if (!isKnownPlugin(slug)) notFound();
  const { manifest } = PLUGIN_REGISTRY[slug];
  const meta = manifest.adminPages.find((p) => p.slug === page);
  if (!meta) notFound();

  const siteId = await requireSiteId();
  await ensurePluginsLoaded(siteId);
  const render = getAdminPage(siteId, slug, page);
  if (!render) notFound();
  // plugin pages are plain server functions (no hooks), so they are called rather than mounted
  const content = await render({ siteId, settings: await getPluginSettings(siteId, manifest) });

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader title={meta.title} back={{ href: `/admin/plugins/${slug}`, label: manifest.name }} />
      {content}
    </main>
  );
}
