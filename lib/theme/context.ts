import { getMenuForLocation } from "@/lib/menus";
import { getSettings } from "@/lib/settings";
import { getPartContent } from "./parts";
import { customizerDefaults, type ThemeManifest } from "./manifest";
import type { ModValue, ThemeContext } from "./types";

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Customizer values for a theme: defaults, then the site's saved values (typed against the manifest). */
export function resolveMods(manifest: ThemeManifest, saved: Record<string, unknown> = {}) {
  const mods: Record<string, ModValue> = customizerDefaults(manifest);
  for (const field of manifest.customizer.settings) {
    const v = saved[field.key];
    if (v === undefined) continue;
    if (field.type === "checkbox" && typeof v === "boolean") mods[field.key] = v;
    else if (field.type === "color" && typeof v === "string" && HEX.test(v)) mods[field.key] = v;
    else if (field.type === "select" && typeof v === "string" && field.options?.some((o) => o.value === v)) mods[field.key] = v;
    else if ((field.type === "text" || field.type === "image") && typeof v === "string") mods[field.key] = v.slice(0, 500);
  }
  return mods;
}

/** CSS custom properties (`--rp-<key>`) for every color setting; values are validated hex only. */
export function cssVars(manifest: ThemeManifest, mods: Record<string, ModValue>): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const f of manifest.customizer.settings) {
    const v = mods[f.key];
    if (f.type === "color" && typeof v === "string" && HEX.test(v)) vars[`--rp-${f.key}`] = v;
  }
  return vars;
}

export async function buildThemeContext(
  siteId: string,
  manifest: ThemeManifest,
  opts: { savedMods?: Record<string, unknown>; preview?: boolean } = {},
): Promise<ThemeContext> {
  const settings = await getSettings(siteId);
  const [primary, footer] = await Promise.all([
    getMenuForLocation(siteId, "primary"),
    getMenuForLocation(siteId, "footer"),
  ]);
  const partContent = await getPartContent(siteId, manifest.slug);
  return {
    site: { title: settings.site_title, tagline: settings.tagline },
    theme: { slug: manifest.slug },
    mods: resolveMods(manifest, opts.savedMods),
    menus: { primary, footer },
    partContent,
    postBase: settings.post_base,
    preview: opts.preview ?? false,
  };
}
