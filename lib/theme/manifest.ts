import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { scanThemeDir } from "@/lib/plugins/scan";

/**
 * Theme package format. Author rules live in themes/README.md; this file is the
 * machine-checked version of them (used by the registry, the install API and tests).
 */

export const THEMES_DIR = path.join(process.cwd(), "themes");

/** Template names a theme may declare. `index` is mandatory (final fallback). */
export const TEMPLATE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PART_NAMES = ["header", "footer"] as const;
export type PartName = (typeof PART_NAMES)[number];

export const customizerField = z
  .object({
    key: z.string().regex(/^[a-z][a-z0-9_]*$/, "setting keys are snake_case"),
    label: z.string().min(1).max(100),
    type: z.enum(["color", "text", "image", "select", "checkbox"]),
    default: z.union([z.string(), z.boolean()]).optional(),
    options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  })
  .superRefine((f, ctx) => {
    if (f.type === "select" && !f.options?.length) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "select settings need options" });
    }
    if (f.type === "color" && typeof f.default === "string" && !/^#[0-9a-fA-F]{6}$/.test(f.default)) {
      ctx.addIssue({ code: "custom", path: ["default"], message: "color defaults are #rrggbb" });
    }
    if (f.type === "checkbox" && f.default !== undefined && typeof f.default !== "boolean") {
      ctx.addIssue({ code: "custom", path: ["default"], message: "checkbox defaults are booleans" });
    }
  });

export const themeManifestSchema = z
  .object({
    name: z.string().min(1).max(60),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case"),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, "version must be semver (1.2.3)"),
    author: z.string().min(1).max(100),
    description: z.string().max(300).default(""),
    /** Template files under templates/<name>.tsx. */
    templates: z.array(z.string().regex(TEMPLATE_NAME)).min(1),
    /** Template part files under parts/<name>.tsx. */
    parts: z.array(z.enum(PART_NAMES)).default([]),
    /** Optional preview image under assets/. */
    screenshot: z.string().optional(),
    customizer: z
      .object({ settings: z.array(customizerField).max(50) })
      .default({ settings: [] }),
  })
  .superRefine((m, ctx) => {
    if (!m.templates.includes("index")) {
      ctx.addIssue({ code: "custom", path: ["templates"], message: 'a theme must provide the "index" template' });
    }
    if (new Set(m.templates).size !== m.templates.length) {
      ctx.addIssue({ code: "custom", path: ["templates"], message: "duplicate template names" });
    }
    const keys = m.customizer.settings.map((s) => s.key);
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({ code: "custom", path: ["customizer"], message: "duplicate customizer keys" });
    }
    if (m.screenshot && !/^assets\/[A-Za-z0-9._-]+$/.test(m.screenshot)) {
      ctx.addIssue({ code: "custom", path: ["screenshot"], message: "screenshot must be a file directly in assets/" });
    }
  });

export type ThemeManifest = z.infer<typeof themeManifestSchema>;

export type ThemeIssue = string;

/** Check a theme folder on disk: manifest valid, declared files present, nothing escapes the folder. */
export function validateThemeDir(dir: string): { ok: true; manifest: ThemeManifest } | { ok: false; issues: ThemeIssue[] } {
  const issues: ThemeIssue[] = [];
  const manifestPath = path.join(dir, "theme.json");
  if (!existsSync(manifestPath)) return { ok: false, issues: ["theme.json is missing"] };

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return { ok: false, issues: ["theme.json is not valid JSON"] };
  }
  const parsed = themeManifestSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => `theme.json: ${i.path.join(".") || "(root)"} ${i.message}`),
    };
  }
  const m = parsed.data;

  if (path.basename(dir) !== m.slug) issues.push(`folder name "${path.basename(dir)}" must equal slug "${m.slug}"`);
  if (!existsSync(path.join(dir, "index.ts"))) issues.push("index.ts (theme entry) is missing");

  const need = (rel: string) => {
    const abs = path.join(dir, rel);
    if (!abs.startsWith(dir + path.sep)) issues.push(`${rel} escapes the theme folder`);
    else if (!existsSync(abs) || !statSync(abs).isFile()) issues.push(`${rel} is declared but missing`);
  };
  for (const t of m.templates) need(`templates/${t}.tsx`);
  for (const p of m.parts) need(`parts/${p}.tsx`);
  if (m.screenshot) need(m.screenshot);

  if (!issues.length) issues.push(...scanThemeDir(dir));

  return issues.length ? { ok: false, issues } : { ok: true, manifest: m };
}

/** Default values for every customizer setting a theme declares. */
export function customizerDefaults(manifest: ThemeManifest): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const s of manifest.customizer.settings) {
    out[s.key] = s.default ?? (s.type === "checkbox" ? false : "");
  }
  return out;
}
