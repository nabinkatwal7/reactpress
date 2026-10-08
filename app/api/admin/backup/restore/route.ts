import { Cap } from "@/lib/caps";
import { reloadPlugins } from "@/lib/plugins/loader";
import { BackupError, MAX_BACKUP_BYTES, restoreBackup } from "@/lib/portability/backup";
import { ImportError } from "@/lib/portability/import";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { SETTINGS_TAG } from "@/lib/site-meta";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

/**
 * Restore a backup zip (the request body) into this site, REPLACING its content, media, menus,
 * widgets, settings, themes and plugins. Requires `?confirm=replace`. All-or-nothing.
 */
export async function POST(request: Request) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  if (new URL(request.url).searchParams.get("confirm") !== "replace") {
    return NextResponse.json({ error: "Restoring replaces this site's current content. Pass confirm=replace to go ahead" }, { status: 400 });
  }
  const declared = Number(request.headers.get("content-length"));
  if (declared > MAX_BACKUP_BYTES + 100 * 1024 * 1024) return NextResponse.json({ error: "That file is too large to be a backup" }, { status: 413 });

  const body = Buffer.from(await request.arrayBuffer());
  const siteId = await requireSiteId();
  try {
    const report = await restoreBackup(siteId, body, { importerId: gate.userId });
    revalidatePath("/", "layout");
    revalidateTag(SETTINGS_TAG, "max");
    await reloadPlugins(siteId);
    return NextResponse.json({ report });
  } catch (e) {
    if (e instanceof BackupError || e instanceof ImportError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[restore] failed:", e);
    return NextResponse.json({ error: "The restore failed and nothing was changed" }, { status: 500 });
  }
}
