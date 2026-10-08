import { Cap } from "@/lib/caps";
import { ExportError, exportSite } from "@/lib/portability/export";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { resolveSite } from "@/lib/site";
import { NextResponse } from "next/server";

/**
 * Download this site as ReactPress JSON (see lib/portability/format.ts). `?media=1` embeds uploaded
 * files as base64 (up to 50 MB; use a backup for more).
 */
export async function GET(request: Request) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const site = await resolveSite();
  try {
    const data = await exportSite(site.id, { includeMedia: new URL(request.url).searchParams.get("media") === "1" });
    const day = data.exported_at.slice(0, 10);
    return new NextResponse(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${site.slug}-${day}.reactpress.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof ExportError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
