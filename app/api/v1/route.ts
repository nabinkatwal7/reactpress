import { preflight, publicJson } from "@/lib/rest/http";
import { getSettings } from "@/lib/settings";
import { requireSiteId, resolveSite, siteBasePath } from "@/lib/site";

export { preflight as OPTIONS };

/** Index: the site and the public endpoints. */
export async function GET() {
  const [site, siteId, base] = await Promise.all([resolveSite(), requireSiteId(), siteBasePath()]);
  const settings = await getSettings(siteId);
  return publicJson({
    site: { name: settings.site_title, tagline: settings.tagline, slug: site.slug },
    api: `${base}/api/v1`,
    endpoints: ["posts", "posts/{id|slug}", "pages", "pages/{id|slug}", "media", "media/{id}", "taxonomies", "terms", "users", "users/{id}"].map(
      (e) => `${base}/api/v1/${e}`,
    ),
  });
}
