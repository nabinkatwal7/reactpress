import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createZip } from "./zip.mjs";

const SKIP_DIRS = new Set(["node_modules", ".git", ".next"]);

async function walk(dir, rel = "") {
  const out = [];
  for (const d of (await readdir(path.join(dir, rel), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const r = rel ? `${rel}/${d.name}` : d.name;
    if (d.isDirectory()) {
      if (!SKIP_DIRS.has(d.name)) out.push(...(await walk(dir, r)));
    } else if (d.isFile()) {
      out.push(r);
    }
  }
  return out;
}

/**
 * Zip a theme or plugin folder and describe it as a registry entry.
 * Files sit at the top of the zip (theme.json / plugin.json at the root). `.reactpress-package.json`
 * (written by installs) is left out.
 * @param {string} folder
 * @param {{ outDir?: string, urlBase?: string }} [options]
 */
export async function packageFolder(folder, { outDir = ".", urlBase } = {}) {
  const dir = path.resolve(folder);
  if (!(await stat(dir).catch(() => null))?.isDirectory()) throw new Error(`${folder} is not a folder`);

  let type = null;
  let manifest = null;
  for (const [t, file] of [["theme", "theme.json"], ["plugin", "plugin.json"]]) {
    try {
      manifest = JSON.parse(await readFile(path.join(dir, file), "utf8"));
      type = t;
      break;
    } catch (e) {
      if (e.code !== "ENOENT") throw new Error(`${file} is not valid JSON`);
    }
  }
  if (!type) throw new Error("No theme.json or plugin.json in that folder");
  for (const k of ["name", "slug", "version", "author"]) if (!manifest[k]) throw new Error(`${type}.json is missing "${k}"`);
  if (path.basename(dir) !== manifest.slug) throw new Error(`The folder name "${path.basename(dir)}" must equal the slug "${manifest.slug}"`);

  const files = (await walk(dir)).filter((f) => f !== ".reactpress-package.json");
  const entries = [];
  for (const f of files) entries.push({ path: f, data: await readFile(path.join(dir, f)) });
  const zip = createZip(entries);
  const file = `${manifest.slug}-${manifest.version}.zip`;
  await writeFile(path.join(outDir, file), zip);

  const entry = {
    type,
    slug: manifest.slug,
    name: manifest.name,
    version: manifest.version,
    author: manifest.author,
    description: manifest.description ?? "",
    download: `${(urlBase ?? "https://example.com/downloads").replace(/\/+$/, "")}/${file}`,
    sha256: createHash("sha256").update(zip).digest("hex"),
    size: zip.length,
  };
  return { file: path.join(outDir, file), files: files.length, entry };
}
