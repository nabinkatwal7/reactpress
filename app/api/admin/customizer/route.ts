import { Cap } from "@/lib/caps";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { discardDraft, getDraft, getLiveValues, saveDraft } from "@/lib/theme/customizer";
import { getActiveThemeSlug, loadTheme } from "@/lib/theme/themes";
import { NextResponse } from "next/server";
import { z } from "zod";

async function active() {
  const siteId = await requireSiteId();
  const { manifest } = await loadTheme(await getActiveThemeSlug(siteId));
  return { siteId, manifest };
}

export async function GET() {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const { siteId, manifest } = await active();
  return NextResponse.json({
    theme: manifest.slug,
    settings: manifest.customizer.settings,
    live: await getLiveValues(siteId, manifest),
    draft: await getDraft(siteId, manifest),
  });
}

/** Save the draft (does not touch the live site). */
export async function PUT(request: Request) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { siteId, manifest } = await active();
  try {
    return NextResponse.json({ draft: await saveDraft(siteId, manifest, body) });
  } catch (e) {
    const msg = e instanceof z.ZodError ? (e.issues[0]?.message ?? "Invalid input") : (e as Error).message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE() {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const { siteId, manifest } = await active();
  await discardDraft(siteId, manifest);
  return NextResponse.json({ ok: true });
}
