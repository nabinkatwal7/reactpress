import { parseBody } from "@/lib/api-json";
import { Cap } from "@/lib/caps";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { loadSettings, saveSettings, settingsPatchSchema } from "@/lib/settings";
import { requireSiteId } from "@/lib/site";
import { SETTINGS_TAG } from "@/lib/site-meta";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

export async function GET() {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  return NextResponse.json({ settings: await loadSettings(await requireSiteId()) });
}

/** Partial update: send only the keys you want to change. */
export async function PUT(request: Request) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const body = await parseBody(request, settingsPatchSchema);
  if ("error" in body) return body.error;
  try {
    const settings = await saveSettings(await requireSiteId(), body.data);
    revalidateTag(SETTINGS_TAG, "max");
    revalidatePath("/", "layout");
    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
