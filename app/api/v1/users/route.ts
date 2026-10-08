import { pageParams, preflight, publicJson } from "@/lib/rest/http";
import { listPublicUsers, restContext } from "@/lib/rest/public";
import { requireSiteId, siteBasePath } from "@/lib/site";

export { preflight as OPTIONS };

/** Authors with published content on this site: id, display name, post count. No emails. */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const ctx = await restContext(await requireSiteId(), await siteBasePath());
  return publicJson(await listPublicUsers(ctx, pageParams(sp)));
}
