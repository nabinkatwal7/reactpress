import { pageParams, preflight, publicJson } from "@/lib/rest/http";
import { listPublicPosts, restContext } from "@/lib/rest/public";
import { requireSiteId, siteBasePath } from "@/lib/site";

export { preflight as OPTIONS };

/**
 * Published posts. Query: page, per_page, search, type, taxonomy + term, author,
 * orderby (date|title|modified), order (asc|desc).
 */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const ctx = await restContext(await requireSiteId(), await siteBasePath());
  return publicJson(await listPublicPosts(ctx, sp, pageParams(sp)));
}
