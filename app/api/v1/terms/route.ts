import { pageParams, preflight, publicJson } from "@/lib/rest/http";
import { listPublicTerms, restContext } from "@/lib/rest/public";
import { requireSiteId, siteBasePath } from "@/lib/site";

export { preflight as OPTIONS };

/** Terms with published-post counts. Query: taxonomy, page, per_page. */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const ctx = await restContext(await requireSiteId(), await siteBasePath());
  return publicJson(await listPublicTerms(ctx, sp.get("taxonomy"), pageParams(sp, 50)));
}
