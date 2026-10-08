import { parseBody } from "@/lib/api-json";
import { activateOnSite, InstallError, installFromRegistry } from "@/lib/marketplace/install";
import { getDefaultNetwork } from "@/lib/network/sites";
import { requireApiSuperAdmin } from "@/lib/require-super-admin";
import { requireSiteId } from "@/lib/site";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  registry: z.string().min(1),
  type: z.enum(["theme", "plugin"]),
  slug: z.string().min(1),
  /** Also switch it on for the site you are working on. */
  activate: z.boolean().optional(),
});

/**
 * Install (or update) a package from one of the network's registries. The download URL is looked up
 * server-side from the registry; the client only names the package.
 */
export async function POST(request: Request) {
  const gate = await requireApiSuperAdmin();
  if ("error" in gate) return gate.error;
  const body = await parseBody(request, schema);
  if ("error" in body) return body.error;

  try {
    const result = await installFromRegistry((await getDefaultNetwork()).id, body.data);
    if (body.data.activate) await activateOnSite(await requireSiteId(), result.item.type, result.item.slug, result.item.version);
    revalidatePath("/", "layout");
    return NextResponse.json({
      installed: { type: result.item.type, slug: result.item.slug, version: result.item.version, replaced: result.replaced },
      activated: !!body.data.activate,
      // a production server serves the code it was built with: rebuild to load the new package
      needsRebuild: process.env.NODE_ENV === "production",
    });
  } catch (e) {
    const status = e instanceof InstallError ? 400 : 500;
    if (status === 500) console.error("[marketplace] install failed:", e);
    return NextResponse.json({ error: status === 500 ? "Install failed" : (e as Error).message }, { status });
  }
}
