import { customizerDefaults, type ThemeManifest } from "./manifest";
import type { ModValue } from "./types";

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
