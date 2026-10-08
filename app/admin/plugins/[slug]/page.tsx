import { PageHeader } from "@/components/admin/page-header";
import { networkPluginSlugs } from "@/lib/network/policy";
import { installPlugin, isKnownPlugin } from "@/lib/plugins/plugins";
import { getPluginSettings } from "@/lib/plugins/settings";
import { prisma } from "@/lib/prisma";
import { requireSiteId } from "@/lib/site";
import { PLUGIN_REGISTRY } from "@/plugins/registry";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PluginSettingsForm } from "./settings-form";

export const instant = false;

type Props = { params: Promise<{ slug: string }> };

export default async function PluginSettingsPage({ params }: Props) {
  const { slug } = await params;
  if (!isKnownPlugin(slug)) notFound();
  const { manifest } = PLUGIN_REGISTRY[slug];
  const siteId = await requireSiteId();
  let install = await prisma.pluginInstall.findUnique({ where: { siteId_slug: { siteId, slug } } });
  // network-activated plugins have no per-site row until the site first opens their settings
  if (!install && (await networkPluginSlugs(siteId)).includes(slug)) install = await installPlugin(siteId, slug);
  if (!install) notFound();

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader title={`${manifest.name} settings`} back={{ href: "/admin/plugins", label: "Plugins" }} />
      {manifest.adminPages.length > 0 && (install.active || (await networkPluginSlugs(siteId)).includes(slug)) ? (
        <ul className="flex flex-wrap gap-3 text-sm">
          {manifest.adminPages.map((p) => (
            <li key={p.slug}>
              <Link href={`/admin/plugins/${slug}/${p.slug}`} className="underline">
                {p.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {manifest.settings.length > 0 ? (
        <PluginSettingsForm slug={slug} fields={manifest.settings} initial={await getPluginSettings(siteId, manifest)} />
      ) : (
        <p className="text-sm text-neutral-500">This plugin has no settings.</p>
      )}
    </main>
  );
}
