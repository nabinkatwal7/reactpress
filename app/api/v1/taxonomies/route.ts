import { preflight, publicJson } from "@/lib/rest/http";
import { publicTaxonomies, restContext } from "@/lib/rest/public";
import { requireSiteId, siteBasePath } from "@/lib/site";

export { preflight as OPTIONS };

export async function GET() {
  const ctx = await restContext(await requireSiteId(), await siteBasePath());
  return publicJson({ data: await publicTaxonomies(ctx) });
}
