import { parseBody } from "@/lib/api-json";
import { toBlocks } from "@/lib/blocks";
import { Cap } from "@/lib/caps";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { isPartName, resetPart, savePart } from "@/lib/theme/parts";
import { getActiveThemeSlug, loadTheme } from "@/lib/theme/themes";
import { postContentSchema } from "@/lib/validations/post";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

type Ctx = { params: Promise<{ slug: string }> };

const bodySchema = z.object({ content: postContentSchema });

/** Resolve the part against the active theme: it must be declared in theme.json. */
async function activePart(slug: string) {
  const siteId = await requireSiteId();
  const theme = await loadTheme(await getActiveThemeSlug(siteId));
  if (!isPartName(slug) || !theme.manifest.parts.includes(slug)) return null;
  return { siteId, theme: theme.slug, slug };
}

export async function PUT(request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const body = await parseBody(request, bodySchema);
  if ("error" in body) return body.error;

  const part = await activePart((await ctx.params).slug);
  if (!part) return NextResponse.json({ error: "Unknown template part" }, { status: 404 });
  await savePart(part.siteId, part.theme, part.slug, toBlocks(body.data.content));
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}

/** Reset to the theme default. */
export async function DELETE(_request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const part = await activePart((await ctx.params).slug);
  if (!part) return NextResponse.json({ error: "Unknown template part" }, { status: 404 });
  await resetPart(part.siteId, part.theme, part.slug);
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
