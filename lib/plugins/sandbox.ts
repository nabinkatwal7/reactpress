import { mkdir, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { STORAGE_ROOT } from "@/lib/media";

/**
 * Plugin sandbox. Plugins are trusted-but-constrained code: an admin installs them from this
 * build, and two layers keep them honest.
 *
 *  1. Runtime: the plugin API only offers site-scoped data (`api.store`, `api.posts`) and files
 *     confined to one folder inside the upload dir (`api.files`). Path escapes are rejected.
 *  2. Install time: `scanPluginDir` (scan.ts) rejects source that imports anything outside the
 *     allow-list (no `fs`, `child_process`, Prisma, auth, env access, eval…). It is a guard against
 *     mistakes and casual abuse, NOT a security boundary against a hostile author: in-process
 *     JavaScript cannot be fully isolated. Only install plugins you would review like core code.
 *
 * Author-facing rules are in plugins/README.md.
 */

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_STORE_VALUE_BYTES = 64 * 1024;
export const MAX_STORE_KEYS = 1000;

/** Folder (inside the upload dir, never served by /media) holding one plugin's files for one site. */
export function pluginFileRoot(siteId: string, slug: string) {
  return path.join(STORAGE_ROOT, "plugin-data", siteId, slug);
}

const REL_PATH = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;

/** Validate a plugin-supplied relative path and resolve it under `root`. Throws on anything unsafe. */
export function resolvePluginPath(root: string, rel: string) {
  if (typeof rel !== "string" || rel.length === 0 || rel.length > 200 || !REL_PATH.test(rel)) {
    throw new Error("Invalid plugin file path");
  }
  if (rel.split("/").some((seg) => seg === "." || seg === "..")) throw new Error("Invalid plugin file path");
  const abs = path.resolve(root, rel);
  if (!abs.startsWith(path.resolve(root) + path.sep)) throw new Error("Invalid plugin file path");
  return abs;
}

/** Throw unless the real (symlink-resolved) location of `p` is inside the real `root`. */
async function assertInside(rootReal: string, p: string) {
  const real = await realpath(p);
  if (real !== rootReal && !real.startsWith(rootReal + path.sep)) throw new Error("Invalid plugin file path");
}

export type PluginFiles = {
  read(rel: string): Promise<Buffer | null>;
  write(rel: string, data: string | Uint8Array): Promise<void>;
  remove(rel: string): Promise<boolean>;
  list(dir?: string): Promise<string[]>;
};

/** File access limited to `root` (created on first write). */
export function createPluginFiles(root: string): PluginFiles {
  const rootReal = async () => {
    await mkdir(root, { recursive: true });
    return realpath(root);
  };
  return {
    async read(rel) {
      const abs = resolvePluginPath(root, rel);
      try {
        await assertInside(await rootReal(), abs);
        return await readFile(abs);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw e;
      }
    },
    async write(rel, data) {
      const abs = resolvePluginPath(root, rel);
      const size = typeof data === "string" ? Buffer.byteLength(data) : data.byteLength;
      if (size > MAX_FILE_BYTES) throw new Error("Plugin file too large");
      const real = await rootReal();
      await mkdir(path.dirname(abs), { recursive: true });
      await assertInside(real, path.dirname(abs));
      await writeFile(abs, data);
    },
    async remove(rel) {
      const abs = resolvePluginPath(root, rel);
      try {
        await assertInside(await rootReal(), abs);
        await rm(abs);
        return true;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return false;
        throw e;
      }
    },
    async list(dir = "") {
      const abs = dir ? resolvePluginPath(root, dir) : root;
      try {
        const real = await rootReal();
        await assertInside(real, abs);
        return (await readdir(abs, { withFileTypes: true })).filter((d) => d.isFile()).map((d) => d.name).sort();
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw e;
      }
    },
  };
}

export async function removePluginFiles(siteId: string, slug: string) {
  await rm(pluginFileRoot(siteId, slug), { recursive: true, force: true });
}
