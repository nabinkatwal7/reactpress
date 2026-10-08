import { preflight, publicError, publicJson } from "@/lib/rest/http";
import { getPublicUser, restContext } from "@/lib/rest/public";
import { requireSiteId, siteBasePath } from "@/lib/site";

export { preflight as OPTIONS };

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const c = await restContext(await requireSiteId(), await siteBasePath());
  const user = await getPublicUser(c, (await ctx.params).id);
  return user ? publicJson({ data: user }) : publicError(404, "Not found");
}
