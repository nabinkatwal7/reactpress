import { parseBody } from "@/lib/api-json";
import { Cap } from "@/lib/caps";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { activateTheme, installTheme, listThemes, uninstallTheme } from "@/lib/theme/themes";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

const actionSchema = z.object({
  action: z.enum(["install", "activate", "uninstall"]),
  slug: z.string().min(1),
});

export async function GET() {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  return NextResponse.json({ themes: await listThemes(await requireSiteId()) });
}

/** One endpoint for theme lifecycle: { action: "install" | "activate" | "uninstall", slug }. */
export async function POST(request: Request) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const body = await parseBody(request, actionSchema);
  if ("error" in body) return body.error;

  const siteId = await requireSiteId();
  try {
    if (body.data.action === "install") await installTheme(siteId, body.data.slug);
    if (body.data.action === "activate") await activateTheme(siteId, body.data.slug);
    if (body.data.action === "uninstall") {
      if (!(await uninstallTheme(siteId, body.data.slug))) {
        return NextResponse.json({ error: "Not installed" }, { status: 404 });
      }
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  revalidatePath("/", "layout");
  return NextResponse.json({ themes: await listThemes(siteId) });
}
