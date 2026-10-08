import { parseBody } from "@/lib/api-json";
import { Cap } from "@/lib/caps";
import { deleteMenu, getMenu, getMenuItemsFlat, renameMenu, saveMenuItems } from "@/lib/menus";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { saveMenuItemsSchema, updateMenuSchema } from "@/lib/validations/menu";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const { id } = await ctx.params;
  const menu = await getMenu(await requireSiteId(), id);
  if (!menu) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ menu, items: await getMenuItemsFlat(id) });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const body = await parseBody(request, updateMenuSchema);
  if ("error" in body) return body.error;
  const { id } = await ctx.params;
  const ok = await renameMenu(await requireSiteId(), id, body.data.name);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/** Replace the full item list (flat, ordered, with depth). */
export async function PUT(request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const body = await parseBody(request, saveMenuItemsSchema);
  if ("error" in body) return body.error;
  const { id } = await ctx.params;
  try {
    const ok = await saveMenuItems(await requireSiteId(), id, body.data.items);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  return NextResponse.json({ items: await getMenuItemsFlat(id) });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const { id } = await ctx.params;
  const ok = await deleteMenu(await requireSiteId(), id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
