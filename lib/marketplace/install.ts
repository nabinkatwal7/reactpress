import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { STORAGE_ROOT } from "@/lib/media";
import { safeFetch } from "@/lib/net/safe-fetch";
import { readZip, type ZipEntry } from "@/lib/net/zip";
import { validatePluginDir } from "@/lib/plugins/manifest";
import { prisma } from "@/lib/prisma";
import { validateThemeDir } from "@/lib/theme/manifest";
import { findCatalogItem, type CatalogItem } from "./catalog";
import { regenerate } from "./generate";
import { MARKER, baseDir, isBundledPackage, packageDir, readMarker, type Marker, type PackageType } from "./packages";

/**
 * Installing a package puts its code on this server: it runs with the app's privileges. So:
 * super admins only; registries must be https and listed by the network; the download is checked
 * against the registry's sha256; the archive is unpacked defensively; only source/asset file types
 * are accepted; and the unpacked code must pass the same validators and import scan as bundled
 * packages (see lib/plugins/scan.ts, which is a guard rail, not a sandbox: review what you install).
 * Set REACTPRESS_DISALLOW_FILE_MODS=1 to turn installs and removals off.
 */

export const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 500;
const ALLOWED_EXT = new Set([
  ".ts", ".tsx", ".json", ".css", ".md", ".txt",
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico",
  ".woff", ".woff2", ".ttf", ".otf",
]);
const ALLOWED_DOTFILES = new Set([".gitkeep"]);

export class InstallError extends Error {}

export function assertFileModsAllowed() {
  if (process.env.REACTPRESS_DISALLOW_FILE_MODS === "1") throw new InstallError("Installing and removing packages is disabled on this server (REACTPRESS_DISALLOW_FILE_MODS)");
}

const tmpRoot = () => path.join(path.dirname(STORAGE_ROOT), "tmp");

/** Pick the package files out of an archive: strips one wrapping folder, filters file types. Pure. */
export function packageFiles(entries: ZipEntry[], manifestFile: string): ZipEntry[] {
  const roots = new Set(entries.map((e) => e.path.split("/")[0]));
  const hasRootManifest = entries.some((e) => e.path === manifestFile);
  const wrapped = !hasRootManifest && roots.size === 1 && entries.every((e) => e.path.includes("/"));
  const files = entries.map((e) => ({ path: wrapped ? e.path.slice(e.path.indexOf("/") + 1) : e.path, data: e.data }));
  if (files.length === 0) throw new InstallError("The archive is empty");
  if (files.length > MAX_FILES) throw new InstallError(`The package has too many files (limit ${MAX_FILES})`);
  for (const f of files) {
    const base = path.posix.basename(f.path);
    const ext = path.posix.extname(base).toLowerCase();
    if (base === MARKER) throw new InstallError(`${f.path}: reserved file name`);
    if (!(ALLOWED_EXT.has(ext) || ALLOWED_DOTFILES.has(base))) throw new InstallError(`${f.path}: file type "${ext || base}" is not allowed in packages`);
  }
  if (!files.some((f) => f.path === manifestFile)) throw new InstallError(`${manifestFile} is missing at the top of the package`);
  return files;
}

function validateFolder(type: PackageType, dir: string) {
  const res = type === "theme" ? validateThemeDir(dir) : validatePluginDir(dir);
  if (!res.ok) throw new InstallError(`The package is invalid: ${res.issues.join("; ")}`);
  return res.manifest;
}

export type InstallResult = { item: CatalogItem; replaced: boolean; marker: Marker };

/** Download, verify, unpack, validate and place a catalog item. Cleans up after itself on failure. */
export async function installFromRegistry(networkId: string, ref: { registry: string; type: string; slug: string }): Promise<InstallResult> {
  assertFileModsAllowed();
  const item = await findCatalogItem(networkId, ref.registry, ref.type, ref.slug);
  if (!item) throw new InstallError("That package is not in the registry");
  if (isBundledPackage(item.type, item.slug)) throw new InstallError(`"${item.slug}" ships with ReactPress and cannot be replaced`);
  if (existsSync(packageDir(item.type, item.slug)) && !readMarker(item.type, item.slug)) {
    throw new InstallError(`A ${item.type} folder named "${item.slug}" already exists and was not installed from a registry`);
  }

  let download;
  try {
    download = await safeFetch(item.download, { maxBytes: Math.min(item.size ?? MAX_DOWNLOAD_BYTES, MAX_DOWNLOAD_BYTES), timeoutMs: 30_000 });
  } catch (e) {
    throw new InstallError(`Download failed: ${(e as Error).message}`);
  }
  const digest = createHash("sha256").update(download.body).digest("hex");
  if (digest !== item.sha256) throw new InstallError("The download does not match the registry's checksum, so it was not installed");

  let entries: ZipEntry[];
  try {
    entries = readZip(download.body);
  } catch (e) {
    throw new InstallError(`The package could not be unpacked: ${(e as Error).message}`);
  }
  const manifestFile = item.type === "theme" ? "theme.json" : "plugin.json";
  const files = packageFiles(entries, manifestFile);

  const work = path.join(tmpRoot(), randomUUID());
  const staged = path.join(work, item.slug);
  const final = packageDir(item.type, item.slug);
  const old = path.join(work, "previous");
  let movedOld = false;
  try {
    for (const f of files) {
      const abs = path.join(staged, f.path);
      if (!abs.startsWith(staged + path.sep)) throw new InstallError(`Unsafe path in package: ${f.path}`);
      mkdirSync(path.dirname(abs), { recursive: true });
      writeFileSync(abs, f.data);
    }
    const manifest = validateFolder(item.type, staged);
    if (manifest.slug !== item.slug) throw new InstallError(`The package says it is "${manifest.slug}", the registry says "${item.slug}"`);
    if (manifest.version !== item.version) throw new InstallError(`The package is version ${manifest.version}, the registry says ${item.version}`);

    const marker: Marker = { type: item.type, slug: item.slug, version: item.version, registry: item.registry, sha256: item.sha256, installedAt: new Date().toISOString() };
    writeFileSync(path.join(staged, MARKER), JSON.stringify(marker, null, 2) + "\n");

    mkdirSync(baseDir(item.type), { recursive: true });
    const replaced = existsSync(final);
    if (replaced) {
      renameSync(final, old);
      movedOld = true;
    }
    renameSync(staged, final);
    regenerate(item.type);
    return { item, replaced, marker };
  } catch (e) {
    if (movedOld && !existsSync(final)) renameSync(old, final); // put the previous version back
    throw e;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Sites and network settings that still reference a package. */
export async function usageOf(type: PackageType, slug: string) {
  const [installs, network] = await Promise.all([
    type === "theme"
      ? prisma.themeInstall.count({ where: { slug } })
      : prisma.pluginInstall.count({ where: { slug } }),
    prisma.network.count({ where: type === "theme" ? { enabledThemes: { has: slug } } : { networkPlugins: { has: slug } } }),
  ]);
  return { installs, network };
}

/** Remove a package that was installed from a registry. Bundled packages are never touched. */
export async function removeInstalledPackage(type: PackageType, slug: string, { force = false } = {}) {
  assertFileModsAllowed();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new InstallError("Invalid slug");
  if (isBundledPackage(type, slug)) throw new InstallError("This package ships with ReactPress and cannot be removed");
  if (!readMarker(type, slug)) throw new InstallError("Not installed from a registry");

  const use = await usageOf(type, slug);
  if ((use.installs || use.network) && !force) {
    throw new InstallError(`It is still used by ${use.installs} site install(s)${use.network ? " and the network settings" : ""}. Remove it anyway to deactivate it everywhere`);
  }
  if (force) {
    if (type === "theme") {
      await prisma.themeInstall.deleteMany({ where: { slug } });
      for (const n of await prisma.network.findMany({ where: { enabledThemes: { has: slug } } })) {
        await prisma.network.update({ where: { id: n.id }, data: { enabledThemes: n.enabledThemes.filter((s) => s !== slug) } });
      }
    } else {
      await prisma.pluginInstall.deleteMany({ where: { slug } });
      await prisma.pluginData.deleteMany({ where: { plugin: slug } });
      for (const n of await prisma.network.findMany({ where: { networkPlugins: { has: slug } } })) {
        await prisma.network.update({ where: { id: n.id }, data: { networkPlugins: n.networkPlugins.filter((s) => s !== slug) } });
      }
    }
  }
  rmSync(packageDir(type, slug), { recursive: true, force: true });
  regenerate(type);
}

/**
 * Switch a freshly installed package on for one site. Writes the install rows directly: the running
 * app may not have picked the new code up yet (dev: next request; production: after a rebuild), and
 * once it does the site simply starts using it.
 */
export async function activateOnSite(siteId: string, type: PackageType, slug: string, version: string) {
  if (type === "theme") {
    await prisma.$transaction([
      prisma.themeInstall.updateMany({ where: { siteId }, data: { active: false } }),
      prisma.themeInstall.upsert({
        where: { siteId_slug: { siteId, slug } },
        update: { version, active: true },
        create: { siteId, slug, version, active: true },
      }),
    ]);
  } else {
    await prisma.pluginInstall.upsert({
      where: { siteId_slug: { siteId, slug } },
      update: { version, active: true },
      create: { siteId, slug, version, active: true },
    });
  }
}
