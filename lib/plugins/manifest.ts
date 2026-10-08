import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { customizerField } from "@/lib/theme/manifest";
import { scanPluginDir } from "./scan";

/**
 * Plugin package format. Author rules live in plugins/README.md; this file is the
 * machine-checked version of them (used by the registry, the install API and tests).
 */

export const PLUGINS_DIR = path.join(process.cwd(), "plugins");

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const pluginManifestSchema = z
  .object({
    name: z.string().min(1).max(60),
    slug: z.string().regex(SLUG, "slug must be kebab-case"),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, "version must be semver (1.2.3)"),
    author: z.string().min(1).max(100),
    description: z.string().max(300).default(""),
    /** Settings screen fields; same field types as theme customizer settings. */
    settings: z.array(customizerField).max(50).default([]),
    /** Admin pages the plugin adds under /admin/plugins/<slug>/<page>. Components come from register.ts. */
    adminPages: z
      .array(z.object({ slug: z.string().regex(SLUG), title: z.string().min(1).max(60) }))
      .max(20)
      .default([]),
  })
  .superRefine((m, ctx) => {
    const keys = m.settings.map((s) => s.key);
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({ code: "custom", path: ["settings"], message: "duplicate setting keys" });
    }
    const pages = m.adminPages.map((p) => p.slug);
    if (new Set(pages).size !== pages.length) {
      ctx.addIssue({ code: "custom", path: ["adminPages"], message: "duplicate admin page slugs" });
    }
  });

export type PluginManifest = z.infer<typeof pluginManifestSchema>;

/** Check a plugin folder on disk: manifest valid, entry present, source passes the sandbox scan. */
export function validatePluginDir(
  dir: string,
): { ok: true; manifest: PluginManifest } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  const manifestPath = path.join(dir, "plugin.json");
  if (!existsSync(manifestPath)) return { ok: false, issues: ["plugin.json is missing"] };

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return { ok: false, issues: ["plugin.json is not valid JSON"] };
  }
  const parsed = pluginManifestSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => `plugin.json: ${i.path.join(".") || "(root)"} ${i.message}`),
    };
  }
  const m = parsed.data;

  if (path.basename(dir) !== m.slug) issues.push(`folder name "${path.basename(dir)}" must equal slug "${m.slug}"`);
  const entry = path.join(dir, "register.ts");
  if (!existsSync(entry) || !statSync(entry).isFile()) issues.push("register.ts (plugin entry) is missing");

  if (!issues.length) issues.push(...scanPluginDir(dir));

  return issues.length ? { ok: false, issues } : { ok: true, manifest: m };
}

/** Default values for every setting a plugin declares. */
export function settingDefaults(manifest: PluginManifest): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const s of manifest.settings) out[s.key] = s.default ?? (s.type === "checkbox" ? false : "");
  return out;
}
