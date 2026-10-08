import { PageHeader } from "@/components/admin/page-header";
import { listPlugins } from "@/lib/plugins/plugins";
import { requireSiteId } from "@/lib/site";
import { PluginActions } from "./plugin-actions";

export const instant = false;

export default async function PluginsPage() {
  const plugins = await listPlugins(await requireSiteId());

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader title="Plugins" />
      <ul className="grid gap-4 md:grid-cols-2">
        {plugins.map(({ manifest, installed, active }) => (
          <li
            key={manifest.slug}
            className={`flex flex-col gap-3 border p-4 ${active ? "border-neutral-900" : "border-neutral-200"}`}
          >
            <div>
              <h2 className="font-medium">
                {manifest.name} <span className="text-sm font-normal text-neutral-500">v{manifest.version}</span>
                {active ? <span className="ml-2 rounded bg-neutral-900 px-2 py-0.5 text-xs text-white">Active</span> : null}
              </h2>
              <p className="text-sm text-neutral-600">{manifest.description}</p>
              <p className="text-xs text-neutral-500">By {manifest.author}</p>
            </div>
            <PluginActions slug={manifest.slug} installed={installed} active={active} />
          </li>
        ))}
        {plugins.length === 0 ? <li className="text-sm text-neutral-500">No plugins available.</li> : null}
      </ul>
    </main>
  );
}
