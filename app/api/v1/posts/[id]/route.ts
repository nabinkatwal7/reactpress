import { preflight, publicError, publicJson } from "@/lib/rest/http";
import { getPublicPost, restContext } from "@/lib/rest/public";
import { requireSiteId, siteBasePath } from "@/lib/site";

export { preflight as OPTIONS };

/** One published post, by id or slug. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const c = await restContext(await requireSiteId(), await siteBasePath());
  const post = await getPublicPost(c, (await ctx.params).id);
  return post ? publicJson({ data: post }) : publicError(404, "Not found");
}
