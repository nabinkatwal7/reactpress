import { getMenuForLocation, getResolvedMenu } from "@/lib/menus";
import { getSettings } from "@/lib/settings";
import { getPublishedMods, type CustomizerValues } from "./customizer";
import type { ThemeManifest } from "./manifest";
import { resolveMods } from "./mods";
import { getPartContent } from "./parts";
import type { ThemeContext } from "./types";

export { cssVars, resolveMods } from "./mods";

/**
 * Build the context handed to templates and parts. With a `draft`, unpublished customizer
 * values (theme options, menus) are used instead of the live ones, for admin preview.
 */
export async function buildThemeContext(
  siteId: string,
  manifest: ThemeManifest,
  opts: { draft?: CustomizerValues | null } = {},
): Promise<ThemeContext> {
  const draft = opts.draft ?? null;
  const settings = await getSettings(siteId);
  const [mods, primary, footer, partContent] = await Promise.all([
    draft ? Promise.resolve(draft.mods) : getPublishedMods(siteId, manifest),
    draft ? (draft.menus.primary ? getResolvedMenu(siteId, draft.menus.primary) : []) : getMenuForLocation(siteId, "primary"),
    draft ? (draft.menus.footer ? getResolvedMenu(siteId, draft.menus.footer) : []) : getMenuForLocation(siteId, "footer"),
    getPartContent(siteId, manifest.slug),
  ]);
  return {
    site: { title: settings.site_title, tagline: settings.tagline },
    theme: { slug: manifest.slug },
    mods: resolveMods(manifest, mods),
    menus: { primary, footer },
    partContent,
    postBase: settings.post_base,
    preview: draft !== null,
  };
}
