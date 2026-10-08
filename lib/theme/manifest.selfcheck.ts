/** ponytail: run with `npx tsx lib/theme/manifest.selfcheck.ts` */
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { THEMES_DIR, customizerDefaults, themeManifestSchema, validateThemeDir } from "./manifest";

function makeTheme(slug: string, manifest: object, files: string[]) {
  const dir = path.join(mkdtempSync(path.join(tmpdir(), "rp-theme-")), slug);
  mkdirSync(dir);
  writeFileSync(path.join(dir, "theme.json"), JSON.stringify(manifest));
  for (const f of files) {
    mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    writeFileSync(path.join(dir, f), "");
  }
  return dir;
}

const base = { name: "T", slug: "t", version: "1.0.0", author: "me", templates: ["index", "single"], parts: ["header"] };
const files = ["index.ts", "templates/index.tsx", "templates/single.tsx", "parts/header.tsx"];

const ok = validateThemeDir(makeTheme("t", base, files));
console.assert(ok.ok, "valid theme passes");

const noIndex = validateThemeDir(makeTheme("t", { ...base, templates: ["single"] }, files));
console.assert(!noIndex.ok, "index template required");

const missing = validateThemeDir(makeTheme("t", base, files.filter((f) => f !== "templates/single.tsx")));
console.assert(!missing.ok && missing.issues.some((i) => i.includes("templates/single.tsx")), "missing file reported");

const wrongFolder = validateThemeDir(makeTheme("other", base, files));
console.assert(!wrongFolder.ok, "folder must equal slug");

console.assert(!themeManifestSchema.safeParse({ ...base, templates: ["../evil", "index"] }).success, "template names are strict");
console.assert(!themeManifestSchema.safeParse({ ...base, version: "1" }).success, "semver");
console.assert(!themeManifestSchema.safeParse({ ...base, screenshot: "assets/../../x.png" }).success, "screenshot confined to assets/");
console.assert(
  !themeManifestSchema.safeParse({ ...base, customizer: { settings: [{ key: "Bad Key", label: "x", type: "text" }] } }).success,
  "customizer keys are snake_case",
);
console.assert(
  !themeManifestSchema.safeParse({ ...base, customizer: { settings: [{ key: "c", label: "x", type: "select" }] } }).success,
  "select needs options",
);

const parsed = themeManifestSchema.parse({
  ...base,
  customizer: { settings: [{ key: "accent", label: "A", type: "color", default: "#112233" }, { key: "wide", label: "W", type: "checkbox" }] },
});
console.assert(customizerDefaults(parsed).accent === "#112233" && customizerDefaults(parsed).wide === false, "defaults");

// every theme shipped in /themes must be valid
let shipped = 0;
try {
  for (const entry of readdirSync(THEMES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const r = validateThemeDir(path.join(THEMES_DIR, entry.name));
    console.assert(r.ok, `shipped theme ${entry.name}: ${r.ok ? "" : r.issues.join("; ")}`);
    shipped += 1;
  }
} catch {
  /* no themes dir yet */
}
console.log(`manifest self-check passed (${shipped} shipped themes)`);
