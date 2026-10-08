/** ponytail: run with `npx tsx lib/cli-scaffold.selfcheck.ts` — what `reactpress scaffold` makes must pass the real validators */
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { validatePluginDir } from "@/lib/plugins/manifest";
import { validateThemeDir } from "@/lib/theme/manifest";
import { scaffold } from "../packages/cli/src/scaffold.mjs";

async function main() {
  const root = mkdtempSync(path.join(tmpdir(), "rp-scaffold-"));
  mkdirSync(path.join(root, "plugins"));
  mkdirSync(path.join(root, "themes"));

  const plugin = await scaffold("plugin", "starter-plugin", { baseDir: path.join(root, "plugins"), author: "Test" });
  const p = validatePluginDir(plugin);
  console.assert(p.ok, `scaffolded plugin is valid: ${p.ok ? "" : p.issues.join("; ")}`);

  const theme = await scaffold("theme", "starter-theme", { baseDir: path.join(root, "themes"), author: "Test" });
  const t = validateThemeDir(theme);
  console.assert(t.ok, `scaffolded theme is valid: ${t.ok ? "" : t.issues.join("; ")}`);

  if (!p.ok || !t.ok) throw new Error("scaffold output failed validation");
  console.log("cli scaffold self-check passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
