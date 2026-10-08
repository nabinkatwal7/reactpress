import { PageHeader } from "@/components/admin/page-header";
import { toBlocks } from "@/lib/blocks";
import { requireSiteId } from "@/lib/site";
import { getPartContent } from "@/lib/theme/parts";
import { getActiveThemeSlug, loadTheme } from "@/lib/theme/themes";
import { PartEditor } from "./part-editor";

export const instant = false;

const LABELS: Record<string, string> = {
  header: "Header — announcement area shown at the top of every page",
  footer: "Footer — extra content shown above the copyright line",
};

export default async function PartsPage() {
  const siteId = await requireSiteId();
  const theme = await loadTheme(await getActiveThemeSlug(siteId));
  const content = await getPartContent(siteId, theme.slug);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader title="Header & footer" />
      <p className="text-sm text-neutral-600">
        Template parts of the active theme (<strong>{theme.manifest.name}</strong>). Content you add here
        appears on every public page; clear it to go back to the theme default.
      </p>
      {theme.manifest.parts.length === 0 ? (
        <p className="text-sm text-neutral-600">This theme has no editable parts.</p>
      ) : (
        <div className="flex max-w-3xl flex-col gap-8">
          {theme.manifest.parts.map((slug) => (
            <PartEditor
              key={slug}
              slug={slug}
              label={LABELS[slug] ?? slug}
              initial={toBlocks(content[slug] ?? [])}
              customised={slug in content}
            />
          ))}
        </div>
      )}
    </main>
  );
}
