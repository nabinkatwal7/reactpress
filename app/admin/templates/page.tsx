import { PageHeader } from "@/components/admin/page-header";
import { requireSiteId } from "@/lib/site";
import { listOverrides } from "@/lib/theme/overrides";
import { getActiveThemeSlug, loadTheme } from "@/lib/theme/themes";
import { OverridesEditor } from "./overrides-editor";

export const instant = false;

export default async function TemplatesPage() {
  const siteId = await requireSiteId();
  const { manifest } = await loadTheme(await getActiveThemeSlug(siteId));
  const overrides = await listOverrides(siteId, manifest.slug);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader title="Template overrides" />
      <p className="max-w-2xl text-sm text-neutral-600">
        Tell <strong>{manifest.name}</strong> to use a different template for this site. For example,
        “wherever <code>page</code> would be used, use <code>page-wide</code>”. A more specific template
        (such as <code>page-about</code>) still wins unless you override that name too.
      </p>
      <OverridesEditor
        templates={manifest.templates}
        overrides={overrides.map((o) => ({ template: o.template, target: o.target }))}
      />
    </main>
  );
}
