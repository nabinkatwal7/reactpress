import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PLUGINS_DIR } from "@/lib/plugins/manifest";
import { THEMES_DIR } from "@/lib/theme/manifest";
import { PLUGIN_REGISTRY } from "@/plugins/registry";
import { THEME_REGISTRY } from "@/themes/registry";

export type PackageType = "theme" | "plugin";

/** Written next to a package installed from a registry; its absence means "shipped with this build". */
export const MARKER = ".reactpress-package.json";

export type Marker = { type: PackageType; slug: string; version: string; registry: string; sha256: string; installedAt: string };

export const baseDir = (type: PackageType) => (type === "theme" ? THEMES_DIR : PLUGINS_DIR);
export const packageDir = (type: PackageType, slug: string) => path.join(baseDir(type), slug);

export function readMarker(type: PackageType, slug: string): Marker | null {
  try {
    return JSON.parse(readFileSync(path.join(packageDir(type, slug), MARKER), "utf8")) as Marker;
  } catch {
    return null;
  }
}

/** Packages that came from a registry (have a marker), found by scanning the folders. */
export function listInstalledPackages(type: PackageType): Marker[] {
  const dir = baseDir(type);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => readMarker(type, d.name))
    .filter((m): m is Marker => m !== null);
}

/** Known to the running build (bundled, or installed and already picked up by the registry). */
export const isKnownPackage = (type: PackageType, slug: string) =>
  Object.hasOwn(type === "theme" ? THEME_REGISTRY : PLUGIN_REGISTRY, slug);

/** Shipped with the build: in the registry and not installed from a marketplace. */
export const isBundledPackage = (type: PackageType, slug: string) => isKnownPackage(type, slug) && readMarker(type, slug) === null;
