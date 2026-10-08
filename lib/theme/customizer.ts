import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getMenu, setMenuLocation } from "@/lib/menus";
import { prisma } from "@/lib/prisma";
import { loadSettings, saveSettings } from "@/lib/settings";
import { resolveMods } from "./mods";
import type { ThemeManifest } from "./manifest";
import type { ModValue } from "./types";

/**
 * Customizer: live (published) values vs. a draft the admin previews before going live.
 * Values cover theme options (logo, colors, …), the homepage and the menu locations.
 */

export const CUSTOMIZER_LOCATIONS = ["primary", "footer"] as const;

export const customizerValuesSchema = z.object({
  mods: z.record(z.string(), z.unknown()).default({}),
  homepage_mode: z.enum(["latest", "page"]),
  homepage_page_id: z.string().min(1).nullable(),
  menus: z.object({
    primary: z.string().min(1).nullable(),
    footer: z.string().min(1).nullable(),
  }),
});

type RawValues = z.infer<typeof customizerValuesSchema>;
/** Validated values: `mods` is normalised against the theme manifest. */
export type CustomizerValues = Omit<RawValues, "mods"> & { mods: Record<string, ModValue> };

/** Theme option values the site has published (raw, before defaults are applied). */
async function publishedMods(siteId: string, theme: string): Promise<Record<string, unknown>> {
  const row = await prisma.themeMods.findUnique({ where: { siteId_theme: { siteId, theme } } });
  const v = row?.published;
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export async function getPublishedMods(siteId: string, manifest: ThemeManifest) {
  return publishedMods(siteId, manifest.slug);
}

/** What is live right now. */
export async function getLiveValues(siteId: string, manifest: ThemeManifest): Promise<CustomizerValues> {
  const [mods, settings, locations] = await Promise.all([
    publishedMods(siteId, manifest.slug),
    loadSettings(siteId),
    prisma.menuLocation.findMany({ where: { siteId } }),
  ]);
  const at = (loc: string) => locations.find((l) => l.location === loc)?.menuId ?? null;
  return {
    mods: resolveMods(manifest, mods),
    homepage_mode: settings.homepage_mode,
    homepage_page_id: settings.homepage_page_id,
    menus: { primary: at("primary"), footer: at("footer") },
  };
}

/** The saved draft, or null when there is none. Stale/invalid drafts are ignored. */
export async function getDraft(siteId: string, manifest: ThemeManifest): Promise<CustomizerValues | null> {
  const row = await prisma.themeMods.findUnique({ where: { siteId_theme: { siteId, theme: manifest.slug } } });
  if (!row?.draft) return null;
  const parsed = customizerValuesSchema.safeParse(row.draft);
  return parsed.success ? { ...parsed.data, mods: resolveMods(manifest, parsed.data.mods) } : null;
}

async function validate(siteId: string, manifest: ThemeManifest, input: unknown): Promise<CustomizerValues> {
  const values = customizerValuesSchema.parse(input);

  if (values.homepage_mode === "page") {
    const page = values.homepage_page_id
      ? await prisma.page.findFirst({
          where: { id: values.homepage_page_id, siteId, status: "publish" },
          select: { id: true },
        })
      : null;
    if (!page) throw new Error("Choose a published page for the homepage");
  }
  for (const loc of CUSTOMIZER_LOCATIONS) {
    const id = values.menus[loc];
    if (id && !(await getMenu(siteId, id))) throw new Error(`Menu for ${loc} not found`);
  }
  // normalise: only keys the theme declares, typed and defaulted
  return { ...values, mods: resolveMods(manifest, values.mods) };
}

export async function saveDraft(siteId: string, manifest: ThemeManifest, input: unknown) {
  const values = await validate(siteId, manifest, input);
  const draft = values as unknown as Prisma.InputJsonValue;
  await prisma.themeMods.upsert({
    where: { siteId_theme: { siteId, theme: manifest.slug } },
    update: { draft },
    create: { siteId, theme: manifest.slug, draft },
  });
  return values;
}

export async function discardDraft(siteId: string, manifest: ThemeManifest) {
  await prisma.themeMods.updateMany({
    where: { siteId, theme: manifest.slug },
    data: { draft: Prisma.DbNull },
  });
}

/** Go live: theme options, homepage and menu locations switch to the draft values; the draft is cleared. */
export async function publishDraft(siteId: string, manifest: ThemeManifest) {
  const draft = await getDraft(siteId, manifest);
  if (!draft) throw new Error("There are no draft changes to publish");
  const values = await validate(siteId, manifest, draft); // re-check: pages/menus may have changed since

  await saveSettings(siteId, {
    homepage_mode: values.homepage_mode,
    homepage_page_id: values.homepage_mode === "page" ? values.homepage_page_id : null,
  });
  for (const loc of CUSTOMIZER_LOCATIONS) {
    await setMenuLocation(siteId, loc, values.menus[loc]);
  }
  const published = values.mods as unknown as Prisma.InputJsonValue;
  await prisma.themeMods.upsert({
    where: { siteId_theme: { siteId, theme: manifest.slug } },
    update: { published, draft: Prisma.DbNull },
    create: { siteId, theme: manifest.slug, published },
  });
  return values;
}
