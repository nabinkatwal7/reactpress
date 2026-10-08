import { cacheTag } from "next/cache";
import { loadSettings } from "@/lib/settings";
import { requireSiteId } from "@/lib/site";

export const SETTINGS_TAG = "settings";

/** Cached so metadata can be prerendered; the settings API revalidates SETTINGS_TAG on save. */
export async function getSiteMeta() {
  "use cache";
  cacheTag(SETTINGS_TAG);
  const settings = await loadSettings(await requireSiteId());
  return { title: settings.site_title, description: settings.tagline };
}
