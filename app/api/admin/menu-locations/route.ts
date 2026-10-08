import { parseBody } from "@/lib/api-json";
import { Cap } from "@/lib/caps";
import { setMenuLocation } from "@/lib/menus";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { setLocationSchema } from "@/lib/validations/menu";
import { NextResponse } from "next/server";

/** Assign (or clear with menuId: null) the menu shown at a theme location. */
export async function PUT(request: Request) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const body = await parseBody(request, setLocationSchema);
  if ("error" in body) return body.error;
  try {
    await setMenuLocation(await requireSiteId(), body.data.location, body.data.menuId);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
