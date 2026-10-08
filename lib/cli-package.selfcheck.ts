/** ponytail: run with `npx tsx lib/cli-package.selfcheck.ts`: what `reactpress package` builds must be readable and installable by the server */
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readZip } from "@/lib/net/zip";
import { packageFiles } from "@/lib/marketplace/install";
import { registryItemSchema } from "@/lib/marketplace/format";
import { scaffold } from "../packages/cli/src/scaffold.mjs";
import { packageFolder } from "../packages/cli/src/package.mjs";

async function main() {
  const root = mkdtempSync(path.join(tmpdir(), "rp-pkg-"));
  mkdirSync(path.join(root, "plugins"));
  mkdirSync(path.join(root, "themes"));
  mkdirSync(path.join(root, "out"));
  for (const [kind, manifest] of [["plugin", "plugin.json"], ["theme", "theme.json"]] as const) {
    const dir = await scaffold(kind, `pkg-${kind}`, { baseDir: path.join(root, `${kind}s`), author: "T" });
    const a = await packageFolder(dir, { outDir: path.join(root, "out"), urlBase: "https://example.com/dl/" });
    const b = await packageFolder(dir, { outDir: path.join(root, "out") });
    console.assert(a.entry.sha256 === b.entry.sha256, `${kind}: packaging is reproducible`);
    const zip = readFileSync(a.file);
    console.assert(createHash("sha256").update(zip).digest("hex") === a.entry.sha256, `${kind}: entry checksum matches the file`);
    const files = packageFiles(readZip(zip), manifest);
    console.assert(files.some((f) => f.path === manifest), `${kind}: the server accepts the package layout`);
    console.assert(registryItemSchema.safeParse(a.entry).success, `${kind}: the entry is a valid registry item`);
    console.assert(a.entry.download === `https://example.com/dl/pkg-${kind}-0.1.0.zip`, `${kind}: download URL built from --url-base`);
  }
  console.log("cli package self-check passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
