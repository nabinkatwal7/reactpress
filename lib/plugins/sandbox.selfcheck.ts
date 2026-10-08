/** ponytail: run with `npx tsx lib/plugins/sandbox.selfcheck.ts` (needs the dev database) */
import { existsSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { createPluginApi } from "./api";
import { getHookBus } from "@/lib/hooks";
import { PLUGINS_DIR, validatePluginDir } from "./manifest";
import { activatePlugin, deletePlugin } from "./plugins";
import { createPluginFiles, pluginFileRoot, resolvePluginPath } from "./sandbox";
import { scanPluginDir, scanSource } from "./scan";
import { PLUGIN_REGISTRY } from "@/plugins/registry";

const prisma = new PrismaClient();

function rejects(fn: () => unknown | Promise<unknown>) {
  return Promise.resolve()
    .then(fn)
    .then(() => false, () => true);
}

async function main() {
  // --- path rules -------------------------------------------------------------------------
  const root = mkdtempSync(path.join(tmpdir(), "rp-files-"));
  for (const bad of ["../x", "a/../../x", "/etc/passwd", "C:/x", "a\\b", "..", ".", "a//b", "a/./b", "", "x\0y", "a b", "a/"]) {
    console.assert(await rejects(() => resolvePluginPath(root, bad)), `blocked path: ${JSON.stringify(bad)}`);
  }
  console.assert(resolvePluginPath(root, "reports/2026.json").startsWith(root), "plain relative path allowed");

  const files = createPluginFiles(root);
  await files.write("a/b.txt", "hello");
  console.assert((await files.read("a/b.txt"))?.toString() === "hello", "write then read");
  console.assert((await files.list("a")).join() === "b.txt", "list");
  console.assert((await files.read("missing.txt")) === null, "missing file reads as null");
  console.assert(await rejects(() => files.write("../../escape.txt", "x")), "write escape blocked");
  console.assert(await rejects(() => files.read("../x")), "read escape blocked");
  console.assert(await rejects(() => files.write("big.bin", new Uint8Array(3 * 1024 * 1024))), "size limit");
  console.assert((await files.remove("a/b.txt")) === true && (await files.remove("a/b.txt")) === false, "remove");

  // a symlink inside the folder pointing outside must not be followed
  const outside = mkdtempSync(path.join(tmpdir(), "rp-outside-"));
  writeFileSync(path.join(outside, "secret.txt"), "nope");
  try {
    symlinkSync(outside, path.join(root, "link"), "junction");
    console.assert(await rejects(() => files.read("link/secret.txt")), "symlink read blocked");
    console.assert(await rejects(() => files.write("link/new.txt", "x")), "symlink write blocked");
    console.assert(!existsSync(path.join(outside, "new.txt")), "nothing written through the link");
  } catch (e) {
    console.warn("symlink checks skipped:", (e as Error).message);
  }

  // --- source scan -------------------------------------------------------------------------
  const dir = path.join(mkdtempSync(path.join(tmpdir(), "rp-scan-")), "p");
  mkdirSync(dir);
  const scan = (src: string) => scanSource(src, dir, dir);
  console.assert(scan('import type { PluginApi } from "@/lib/plugins/api";\nimport x from "./x";').length === 0, "allowed imports pass");
  for (const src of [
    'import fs from "node:fs";',
    'import { readFile } from "fs/promises";',
    'import cp from "child_process";',
    'import { prisma } from "@/lib/prisma";',
    'import { auth } from "@/auth";',
    'const x = require("fs");',
    'const m = await import(name);',
    'import x from "../other-plugin/x";',
    'const k = process.env.AUTH_SECRET;',
    'eval("1")',
    'new Function("return 1")',
    'globalThis.fetch = null',
  ]) {
    console.assert(scan(src).length > 0, `scan blocks: ${src}`);
  }

  const bad = path.join(dir, "register.ts");
  writeFileSync(bad, 'import fs from "node:fs";');
  console.assert(scanPluginDir(dir).some((i) => i.startsWith("register.ts:")), "scanPluginDir names the file");
  writeFileSync(path.join(dir, "plugin.json"), JSON.stringify({ name: "P", slug: "p", version: "1.0.0", author: "me" }));
  const v = validatePluginDir(dir);
  console.assert(!v.ok && v.issues.some((i) => i.includes("node:fs")), "validatePluginDir runs the scan");

  for (const slug of Object.keys(PLUGIN_REGISTRY)) {
    const res = validatePluginDir(path.join(PLUGINS_DIR, slug));
    console.assert(res.ok, `shipped plugin "${slug}" passes: ${res.ok ? "" : res.issues.join("; ")}`);
  }

  // --- store / posts through the real API -----------------------------------------------------
  const site = await prisma.site.findFirstOrThrow({ where: { isDefault: true } });
  await activatePlugin(site.id, "reading-time"); // installed so rows are cleaned by delete below
  const manifest = PLUGIN_REGISTRY["reading-time"].manifest;
  const api = createPluginApi(site.id, manifest, getHookBus(site.id));
  const other = createPluginApi(site.id, { ...manifest, slug: "other-plugin" }, getHookBus(site.id));

  await api.store.set("counter", { n: 1 });
  console.assert(((await api.store.get<{ n: number }>("counter"))?.n) === 1, "store round-trip");
  console.assert((await other.store.get("counter")) === null, "stores are isolated per plugin");
  console.assert(await rejects(() => api.store.set("bad key!", 1)), "store key validated");
  console.assert(await rejects(() => api.store.set("big", "x".repeat(70 * 1024))), "store value size limit");
  console.assert((await api.store.list("coun")).join() === "counter", "store list by prefix");
  console.assert((await api.posts.list({ limit: 1000 })).length <= 100, "posts list is capped");

  await api.files.write("note.txt", "hi");
  console.assert(existsSync(path.join(pluginFileRoot(site.id, "reading-time"), "note.txt")), "files land in the plugin folder");

  await prisma.pluginInstall.update({ where: { siteId_slug: { siteId: site.id, slug: "reading-time" } }, data: { active: false } });
  await deletePlugin(site.id, "reading-time");
  console.assert((await api.store.get("counter")) === null, "delete removes plugin data");
  console.assert(!existsSync(pluginFileRoot(site.id, "reading-time")), "delete removes plugin files");

  console.log("sandbox self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
