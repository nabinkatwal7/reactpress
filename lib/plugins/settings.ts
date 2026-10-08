import { prisma } from "@/lib/prisma";
import { settingDefaults, type PluginManifest } from "./manifest";

export type SettingValues = Record<string, string | boolean>;

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Defaults overlaid with `input`, keeping only keys the manifest declares and values of the right type. */
export function coerceSettings(manifest: PluginManifest, input: unknown): SettingValues {
  const saved = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const out = settingDefaults(manifest);
  for (const f of manifest.settings) {
    const v = saved[f.key];
    if (v === undefined) continue;
    if (f.type === "checkbox" && typeof v === "boolean") out[f.key] = v;
    else if (f.type === "color" && typeof v === "string" && HEX.test(v)) out[f.key] = v;
    else if (f.type === "select" && typeof v === "string" && f.options?.some((o) => o.value === v)) out[f.key] = v;
    else if ((f.type === "text" || f.type === "image") && typeof v === "string") out[f.key] = v.slice(0, 500);
  }
  return out;
}

export async function getPluginSettings(siteId: string, manifest: PluginManifest): Promise<SettingValues> {
  const row = await prisma.pluginInstall.findUnique({
    where: { siteId_slug: { siteId, slug: manifest.slug } },
    select: { settings: true },
  });
  return coerceSettings(manifest, row?.settings);
}

/** Save values for an installed plugin. Returns the stored (coerced) values, or null if not installed. */
export async function savePluginSettings(siteId: string, manifest: PluginManifest, input: unknown) {
  const values = coerceSettings(manifest, input);
  const res = await prisma.pluginInstall.updateMany({
    where: { siteId, slug: manifest.slug },
    data: { settings: values },
  });
  return res.count > 0 ? values : null;
}
