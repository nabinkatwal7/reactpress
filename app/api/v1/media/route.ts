import { pageParams, preflight, publicJson } from "@/lib/rest/http";
import { listPublicMedia, restContext } from "@/lib/rest/public";
import { requireSiteId, siteBasePath } from "@/lib/site";

export { preflight as OPTIONS };

/** Media used as the featured image of a published post. The full library needs the admin API. */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const ctx = await restContext(await requireSiteId(), await siteBasePath());
  return publicJson(await listPublicMedia(ctx, pageParams(sp)));
}
