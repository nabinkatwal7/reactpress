import { prisma } from "@/lib/prisma";
import { TEMPLATE_NAME, type ThemeManifest } from "./manifest";

/** Per-site template overrides for a theme as a { hierarchyName: targetTemplate } map. */
export async function getOverrideMap(siteId: string, theme: string): Promise<Record<string, string>> {
  const rows = await prisma.templateOverride.findMany({ where: { siteId, theme } });
  return Object.fromEntries(rows.map((r) => [r.template, r.target]));
}

export async function listOverrides(siteId: string, theme: string) {
  return prisma.templateOverride.findMany({ where: { siteId, theme }, orderBy: { template: "asc" } });
}

/**
 * "Wherever `template` would be used, use `target`."
 * `template` is a hierarchy name (page, single-post, page-about, …); `target` must be a template
 * the theme actually ships, and may not point at itself.
 */
export async function setOverride(siteId: string, manifest: ThemeManifest, template: string, target: string) {
  if (!TEMPLATE_NAME.test(template)) throw new Error("Invalid template name");
  if (!manifest.templates.includes(target)) throw new Error(`The theme has no "${target}" template`);
  if (template === target) throw new Error("A template cannot override itself");
  return prisma.templateOverride.upsert({
    where: { siteId_theme_template: { siteId, theme: manifest.slug, template } },
    update: { target },
    create: { siteId, theme: manifest.slug, template, target },
  });
}

export async function removeOverride(siteId: string, theme: string, template: string) {
  const res = await prisma.templateOverride.deleteMany({ where: { siteId, theme, template } });
  return res.count > 0;
}
