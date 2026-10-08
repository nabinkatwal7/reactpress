import { Cap } from "@/lib/caps";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { publishDraft } from "@/lib/theme/customizer";
import { getActiveThemeSlug, loadTheme } from "@/lib/theme/themes";
import { revalidatePath, revalidateTag } from "next/cache";
import { SETTINGS_TAG } from "@/lib/site-meta";
import { NextResponse } from "next/server";

/** Make the draft live. */
export async function POST() {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const siteId = await requireSiteId();
  const { manifest } = await loadTheme(await getActiveThemeSlug(siteId));
  try {
    const live = await publishDraft(siteId, manifest);
    revalidateTag(SETTINGS_TAG, "max");
    revalidatePath("/", "layout");
    return NextResponse.json({ live });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
