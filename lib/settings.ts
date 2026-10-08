import { cache } from "react";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

/** URL prefix for single posts. Pages always live at /<slug>. */
export const POST_BASES = ["posts", "blog", "articles"] as const;

/** Known options. Unknown keys are rejected so the store stays typed. */
export const SETTINGS = {
  site_title: { schema: z.string().trim().min(1, "Site title is required").max(100), default: "ReactPress" },
  tagline: { schema: z.string().trim().max(200), default: "Just another ReactPress site" },
  homepage_mode: { schema: z.enum(["latest", "page"]), default: "latest" },
  homepage_page_id: { schema: z.string().min(1).nullable(), default: null },
  posts_per_page: { schema: z.number().int().min(1).max(100), default: 10 },
  post_base: { schema: z.enum(POST_BASES), default: "posts" },
} as const;

export type SettingKey = keyof typeof SETTINGS;
export type SiteSettings = { [K in SettingKey]: z.infer<(typeof SETTINGS)[K]["schema"]> };

export const settingsPatchSchema = z
  .object(Object.fromEntries(Object.entries(SETTINGS).map(([k, v]) => [k, v.schema.optional()])) as {
    [K in SettingKey]: z.ZodOptional<(typeof SETTINGS)[K]["schema"]>;
  })
  .strict();

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

function defaults(): SiteSettings {
  return Object.fromEntries(Object.entries(SETTINGS).map(([k, v]) => [k, v.default])) as SiteSettings;
}

/** All settings for a site, defaults filled in; invalid stored values fall back to the default. */
export async function loadSettings(siteId: string): Promise<SiteSettings> {
  const rows = await prisma.setting.findMany({ where: { siteId } });
  const out = defaults() as Record<string, unknown>;
  for (const row of rows) {
    const def = SETTINGS[row.key as SettingKey];
    if (!def) continue;
    const parsed = def.schema.safeParse(row.value);
    if (parsed.success) out[row.key] = parsed.data;
  }
  return out as SiteSettings;
}

/** Per-request cached read for server components. */
export const getSettings = cache(loadSettings);

export async function saveSettings(siteId: string, patch: SettingsPatch) {
  if (patch.homepage_mode === "page" || patch.homepage_page_id) {
    const current = await loadSettings(siteId);
    const pageId = patch.homepage_page_id !== undefined ? patch.homepage_page_id : current.homepage_page_id;
    const mode = patch.homepage_mode ?? current.homepage_mode;
    if (mode === "page") {
      const page = pageId
        ? await prisma.page.findFirst({ where: { id: pageId, siteId, status: "publish" }, select: { id: true } })
        : null;
      if (!page) throw new Error("Choose a published page for the homepage");
    }
  }

  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  await prisma.$transaction(
    entries.map(([key, raw]) => {
      const value = raw === null ? Prisma.JsonNull : (raw as Prisma.InputJsonValue);
      return prisma.setting.upsert({
        where: { siteId_key: { siteId, key } },
        update: { value },
        create: { siteId, key, value },
      });
    }),
  );
  return loadSettings(siteId);
}

export function postPath(settings: Pick<SiteSettings, "post_base">, slug: string) {
  return `/${settings.post_base}/${slug}`;
}
