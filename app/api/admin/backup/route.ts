import { Cap } from "@/lib/caps";
import { BackupError, createBackup } from "@/lib/portability/backup";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { resolveSite } from "@/lib/site";
import { NextResponse } from "next/server";

/** Download a backup of this site: a zip with the content as JSON, a checksum manifest and the uploaded files. */
export async function GET() {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const site = await resolveSite();
  try {
    const { zip } = await createBackup(site.id);
    return new NextResponse(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${site.slug}-${new Date().toISOString().slice(0, 10)}.reactpress-backup.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof BackupError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
