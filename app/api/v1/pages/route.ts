import { pageParams, preflight, publicJson } from "@/lib/rest/http";
import { listPublicPages, restContext } from "@/lib/rest/public";
import { requireSiteId, siteBasePath } from "@/lib/site";

export { preflight as OPTIONS };

/** Published pages. Query: page, per_page, search, parent, orderby (date|title|modified), order. */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const ctx = await restContext(await requireSiteId(), await siteBasePath());
  return publicJson(await listPublicPages(ctx, sp, pageParams(sp)));
}
