import path from "node:path";
import { allowedThemeSlugs } from "@/lib/network/policy";
import { prisma } from "@/lib/prisma";
import { DEFAULT_THEME, THEME_REGISTRY } from "@/themes/registry";
import { THEMES_DIR, validateThemeDir, type ThemeManifest } from "./manifest";
import type { ThemeModule } from "./types";

export type ThemeListing = {
  manifest: ThemeManifest;
  installed: boolean;
  active: boolean;
  /** False when the network does not allow this site to activate the theme. */
  allowed: boolean;
};

export function isKnownTheme(slug: string) {
  return slug in THEME_REGISTRY;
}

/** Slug of the site's active theme; falls back to the default theme when none is set or it vanished. */
export async function getActiveThemeSlug(siteId: string): Promise<string> {
  const row = await prisma.themeInstall.findFirst({ where: { siteId, active: true } });
  return row && isKnownTheme(row.slug) ? row.slug : DEFAULT_THEME;
}

export async function listThemes(siteId: string): Promise<ThemeListing[]> {
  const [rows, activeSlug, allowed] = await Promise.all([
    prisma.themeInstall.findMany({ where: { siteId } }),
    getActiveThemeSlug(siteId),
    allowedThemeSlugs(siteId),
  ]);
  const installed = new Set(rows.map((r) => r.slug));
  return Object.values(THEME_REGISTRY).map(({ manifest }) => ({
    manifest,
    // the default theme is always usable even before anyone installs it
    installed: installed.has(manifest.slug) || manifest.slug === DEFAULT_THEME,
    active: manifest.slug === activeSlug,
    // a theme already in use stays usable; the rule only stops new activations
    allowed: !allowed || allowed.has(manifest.slug) || manifest.slug === activeSlug,
  }));
}

/** Install = record it for the site after checking the package on disk. */
async function assertAllowed(siteId: string, slug: string) {
  const allowed = await allowedThemeSlugs(siteId);
  if (allowed && !allowed.has(slug)) throw new Error("This theme is not enabled for the network");
}

export async function installTheme(siteId: string, slug: string) {
  if (!isKnownTheme(slug)) throw new Error("Unknown theme");
  await assertAllowed(siteId, slug);
  const check = validateThemeDir(path.join(THEMES_DIR, slug));
  if (!check.ok) throw new Error(`Theme is invalid: ${check.issues.join("; ")}`);
  return prisma.themeInstall.upsert({
    where: { siteId_slug: { siteId, slug } },
    update: { version: check.manifest.version },
    create: { siteId, slug, version: check.manifest.version },
  });
}

export async function activateTheme(siteId: string, slug: string) {
  if (!isKnownTheme(slug)) throw new Error("Unknown theme");
  // activating an uninstalled theme installs it first, like WordPress does for the default theme
  await installTheme(siteId, slug);
  await prisma.$transaction([
    prisma.themeInstall.updateMany({ where: { siteId }, data: { active: false } }),
    prisma.themeInstall.update({ where: { siteId_slug: { siteId, slug } }, data: { active: true } }),
  ]);
}

export async function uninstallTheme(siteId: string, slug: string) {
  if ((await getActiveThemeSlug(siteId)) === slug) throw new Error("Cannot remove the active theme");
  const res = await prisma.themeInstall.deleteMany({ where: { siteId, slug } });
  return res.count > 0;
}

export async function loadTheme(slug: string): Promise<{ manifest: ThemeManifest; module: ThemeModule; slug: string }> {
  const entry = THEME_REGISTRY[slug] ?? THEME_REGISTRY[DEFAULT_THEME];
  return { slug: entry.manifest.slug, manifest: entry.manifest, module: await entry.load() };
}
