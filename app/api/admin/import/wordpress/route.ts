import { Cap } from "@/lib/caps";
import { SETTINGS_TAG } from "@/lib/site-meta";
import { ImportError } from "@/lib/portability/import";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { importWordPress } from "@/lib/wordpress/import";
import { WxrError } from "@/lib/wordpress/wxr";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

/**
 * Import a WordPress export (WXR / "Tools > Export" XML). The body is the XML itself.
 * `?media=1` also downloads the attachments from the original site into the media library.
 * Always adds to the site; nothing existing is removed.
 */
export async function POST(request: Request) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;

  const downloadMedia = new URL(request.url).searchParams.get("media") === "1";
  const xml = await request.text();
  if (!xml.trim()) return NextResponse.json({ error: "The body must be a WordPress export (XML)" }, { status: 400 });

  try {
    const report = await importWordPress(await requireSiteId(), xml, { importerId: gate.userId, downloadMedia });
    revalidatePath("/", "layout");
    revalidateTag(SETTINGS_TAG, "max");
    return NextResponse.json({ report });
  } catch (e) {
    if (e instanceof WxrError || e instanceof ImportError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[wordpress import] failed:", e);
    return NextResponse.json({ error: "The import failed and nothing was changed" }, { status: 500 });
  }
}
