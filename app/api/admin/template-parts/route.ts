import { Cap } from "@/lib/caps";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { getPartContent } from "@/lib/theme/parts";
import { getActiveThemeSlug, loadTheme } from "@/lib/theme/themes";
import { NextResponse } from "next/server";

/** The active theme's parts with any site-edited content. */
export async function GET() {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const siteId = await requireSiteId();
  const theme = await loadTheme(await getActiveThemeSlug(siteId));
  return NextResponse.json({
    theme: theme.slug,
    parts: theme.manifest.parts,
    content: await getPartContent(siteId, theme.slug),
  });
}
