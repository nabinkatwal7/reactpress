import { parseBody } from "@/lib/api-json";
import { Cap } from "@/lib/caps";
import { createMenu, listMenus, MENU_LOCATIONS } from "@/lib/menus";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { createMenuSchema } from "@/lib/validations/menu";
import { NextResponse } from "next/server";

export async function GET() {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  return NextResponse.json({
    menus: await listMenus(await requireSiteId()),
    locations: MENU_LOCATIONS,
  });
}

export async function POST(request: Request) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const body = await parseBody(request, createMenuSchema);
  if ("error" in body) return body.error;
  const menu = await createMenu(await requireSiteId(), body.data.name);
  return NextResponse.json({ menu }, { status: 201 });
}
