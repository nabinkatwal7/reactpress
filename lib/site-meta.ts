import { cacheTag } from "next/cache";
import { loadSettings } from "@/lib/settings";
import { requireSiteId } from "@/lib/site";

export const SETTINGS_TAG = "settings";

/** Cached so metadata can be prerendered; the settings API revalidates SETTINGS_TAG on save. */
async function cachedSiteMeta(siteId: string) {
  "use cache";
  cacheTag(SETTINGS_TAG);
  const settings = await loadSettings(siteId);
  return { title: settings.site_title, description: settings.tagline };
}

/** The site id is resolved outside the cache (it depends on the request) and becomes part of the cache key. */
export async function getSiteMeta() {
  return cachedSiteMeta(await requireSiteId());
}
