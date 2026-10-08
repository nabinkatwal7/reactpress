/** ponytail: run with `npx tsx lib/plugins/manifest.selfcheck.ts` */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pluginManifestSchema, settingDefaults, validatePluginDir } from "./manifest";

function makePlugin(slug: string, manifest: object, files: string[]) {
  const dir = path.join(mkdtempSync(path.join(tmpdir(), "rp-plugin-")), slug);
  mkdirSync(dir);
  writeFileSync(path.join(dir, "plugin.json"), JSON.stringify(manifest));
  for (const f of files) writeFileSync(path.join(dir, f), "");
  return dir;
}

const base = { name: "P", slug: "p", version: "1.0.0", author: "me" };

console.assert(validatePluginDir(makePlugin("p", base, ["register.ts"])).ok, "valid plugin passes");
console.assert(!validatePluginDir(makePlugin("p", base, [])).ok, "register.ts required");
console.assert(!validatePluginDir(makePlugin("other", base, ["register.ts"])).ok, "folder must equal slug");
console.assert(!validatePluginDir(makePlugin("p", { ...base, version: "1" }, ["register.ts"])).ok, "semver");
console.assert(!pluginManifestSchema.safeParse({ ...base, slug: "../x" }).success, "slug is strict");
console.assert(
  !pluginManifestSchema.safeParse({ ...base, adminPages: [{ slug: "a", title: "A" }, { slug: "a", title: "B" }] }).success,
  "duplicate admin pages rejected",
);
console.assert(
  !pluginManifestSchema.safeParse({ ...base, settings: [{ key: "k", label: "K", type: "text" }, { key: "k", label: "L", type: "text" }] }).success,
  "duplicate setting keys rejected",
);
const m = pluginManifestSchema.parse({ ...base, settings: [{ key: "greeting", label: "G", type: "text", default: "hi" }, { key: "on", label: "O", type: "checkbox" }] });
console.assert(settingDefaults(m).greeting === "hi" && settingDefaults(m).on === false, "defaults");

console.log("plugin manifest self-check passed");
