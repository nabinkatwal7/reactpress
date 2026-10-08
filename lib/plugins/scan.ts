import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Install-time source scan for plugin folders (see sandbox.ts for the whole model). Pure: no
 * database or storage access, so the manifest validator can call it.
 */

/** Everything a plugin may import. Relative imports inside its own folder are always allowed. */
export const ALLOWED_IMPORTS = [
  "react",
  "react/jsx-runtime",
  "next/link",
  "@/lib/blocks",
  "@/lib/plugins/api",
  "@/lib/plugins/admin-pages",
  "@/lib/plugins/settings",
];

const SOURCE_FILE = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/;

const IMPORT_SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*|\bexport\s*\*\s*from\s*)(["'`])([^"'`\n]+)\1/g;

/** Tokens that have no business in plugin code. Comments count too: don't mention them. */
const FORBIDDEN: [RegExp, string][] = [
  [/\bprocess\b/, "process (env, exit, bindings)"],
  [/\beval\s*\(/, "eval()"],
  [/\bnew\s+Function\b|\bFunction\s*\(/, "Function constructor"],
  [/\bglobalThis\b|\bglobal\b/, "global scope access"],
  [/\brequire\s*\(/, "require() (use static imports)"],
  [/\bimport\s*\(\s*[^"'`\s)]/, "dynamic import with a non-literal specifier"],
];

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const abs = path.join(dir, name);
    if (statSync(abs).isDirectory()) {
      if (name !== "node_modules") walk(abs, out);
    } else if (SOURCE_FILE.test(name)) out.push(abs);
  }
  return out;
}

/** Check one source file's text. Returns human-readable violations (empty = clean). */
export function scanSource(source: string, fileDir: string, pluginDir: string): string[] {
  const issues: string[] = [];
  for (const m of source.matchAll(IMPORT_SPECIFIER)) {
    const spec = m[2];
    if (spec.startsWith(".")) {
      const target = path.resolve(fileDir, spec);
      if (target !== pluginDir && !target.startsWith(pluginDir + path.sep)) issues.push(`import "${spec}" escapes the plugin folder`);
    } else if (!ALLOWED_IMPORTS.includes(spec)) {
      issues.push(`import "${spec}" is not allowed (allowed: ${ALLOWED_IMPORTS.join(", ")})`);
    }
  }
  for (const [re, label] of FORBIDDEN) if (re.test(source)) issues.push(`uses ${label}`);
  return issues;
}

/** Scan every source file in a plugin folder. Issues are prefixed with the file they come from. */
export function scanPluginDir(dir: string): string[] {
  const root = path.resolve(dir);
  return walk(root).flatMap((file) =>
    scanSource(readFileSync(file, "utf8"), path.dirname(file), root).map(
      (issue) => `${path.relative(root, file).replaceAll("\\", "/")}: ${issue}`,
    ),
  );
}
