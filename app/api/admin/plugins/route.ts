import { parseBody } from "@/lib/api-json";
import { Cap } from "@/lib/caps";
import { activatePlugin, deactivatePlugin, deletePlugin, installPlugin, listPlugins } from "@/lib/plugins/plugins";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

const actionSchema = z.object({
  action: z.enum(["install", "activate", "deactivate", "delete"]),
  slug: z.string().min(1),
});

export async function GET() {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  return NextResponse.json({ plugins: await listPlugins(await requireSiteId()) });
}

/** One endpoint for plugin lifecycle: { action: "install" | "activate" | "deactivate" | "delete", slug }. */
export async function POST(request: Request) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const body = await parseBody(request, actionSchema);
  if ("error" in body) return body.error;

  const siteId = await requireSiteId();
  const { action, slug } = body.data;
  try {
    if (action === "install") await installPlugin(siteId, slug);
    if (action === "activate") await activatePlugin(siteId, slug);
    if (action === "deactivate" && !(await deactivatePlugin(siteId, slug))) {
      return NextResponse.json({ error: "Not installed" }, { status: 404 });
    }
    if (action === "delete" && !(await deletePlugin(siteId, slug))) {
      return NextResponse.json({ error: "Not installed" }, { status: 404 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  revalidatePath("/", "layout");
  return NextResponse.json({ plugins: await listPlugins(siteId) });
}
