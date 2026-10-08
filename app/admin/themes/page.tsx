import { PageHeader } from "@/components/admin/page-header";
import { requireSiteId } from "@/lib/site";
import { listThemes } from "@/lib/theme/themes";
import { ThemeActions } from "./theme-actions";

export const instant = false;

export default async function ThemesPage() {
  const themes = await listThemes(await requireSiteId());

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader title="Themes" />
      <ul className="grid gap-4 md:grid-cols-2">
        {themes.map(({ manifest, installed, active }) => (
          <li
            key={manifest.slug}
            className={`flex flex-col gap-3 border p-4 ${active ? "border-neutral-900" : "border-neutral-200"}`}
          >
            {manifest.screenshot ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/theme-assets/${manifest.slug}/${manifest.screenshot.replace(/^assets\//, "")}`}
                alt=""
                className="aspect-[3/2] w-full border border-neutral-200 object-cover"
              />
            ) : null}
            <div>
              <h2 className="font-medium">
                {manifest.name} <span className="text-sm font-normal text-neutral-500">v{manifest.version}</span>
                {active ? <span className="ml-2 rounded bg-neutral-900 px-2 py-0.5 text-xs text-white">Active</span> : null}
              </h2>
              <p className="text-sm text-neutral-600">{manifest.description}</p>
              <p className="text-xs text-neutral-500">By {manifest.author}</p>
            </div>
            <ThemeActions slug={manifest.slug} installed={installed} active={active} />
          </li>
        ))}
      </ul>
    </main>
  );
}
