import { parseBody } from "@/lib/api-json";
import { Cap } from "@/lib/caps";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { listOverrides, removeOverride, setOverride } from "@/lib/theme/overrides";
import { getActiveThemeSlug, loadTheme } from "@/lib/theme/themes";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

const setSchema = z.object({ template: z.string().min(1), target: z.string().min(1) });
const removeSchema = z.object({ template: z.string().min(1) });

async function active() {
  const siteId = await requireSiteId();
  const theme = await loadTheme(await getActiveThemeSlug(siteId));
  return { siteId, manifest: theme.manifest };
}

export async function GET() {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const { siteId, manifest } = await active();
  return NextResponse.json({
    theme: manifest.slug,
    templates: manifest.templates,
    overrides: await listOverrides(siteId, manifest.slug),
  });
}

/** Add or change an override for the active theme. */
export async function PUT(request: Request) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const body = await parseBody(request, setSchema);
  if ("error" in body) return body.error;
  const { siteId, manifest } = await active();
  try {
    const override = await setOverride(siteId, manifest, body.data.template, body.data.target);
    revalidatePath("/", "layout");
    return NextResponse.json({ override });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const body = await parseBody(request, removeSchema);
  if ("error" in body) return body.error;
  const { siteId, manifest } = await active();
  if (!(await removeOverride(siteId, manifest.slug, body.data.template))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
