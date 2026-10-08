import { SETTINGS_TAG } from "@/lib/site-meta";
import { Cap } from "@/lib/caps";
import { reloadPlugins } from "@/lib/plugins/loader";
import { ImportError, importSite, parseExport } from "@/lib/portability/import";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

/**
 * Import a ReactPress JSON export into this site. The body is the export file itself.
 *   ?mode=merge    add the content next to what is here (default)
 *   ?mode=replace&confirm=replace    wipe this site's content, settings, menus, widgets, themes and plugins first
 */
export async function POST(request: Request) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;

  const sp = new URL(request.url).searchParams;
  const mode = sp.get("mode") === "replace" ? "replace" : "merge";
  if (mode === "replace" && sp.get("confirm") !== "replace") {
    return NextResponse.json({ error: "Replacing a site deletes its current content. Pass confirm=replace to go ahead" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "The body must be a ReactPress export (JSON)" }, { status: 400 });
  }

  const siteId = await requireSiteId();
  try {
    const report = await importSite(siteId, parseExport(json), { mode, importerId: gate.userId });
    revalidatePath("/", "layout");
    revalidateTag(SETTINGS_TAG, "max");
    if (mode === "replace") await reloadPlugins(siteId);
    return NextResponse.json({ report });
  } catch (e) {
    if (e instanceof ImportError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[import] failed:", e);
    return NextResponse.json({ error: "The import failed and nothing was changed" }, { status: 500 });
  }
}
