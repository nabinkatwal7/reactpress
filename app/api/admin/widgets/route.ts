import { parseBody } from "@/lib/api-json";
import { Cap } from "@/lib/caps";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import {
  addWidget,
  createWidgetSchema,
  listAreasWithWidgets,
  WIDGET_TYPES,
} from "@/lib/widgets";
import { NextResponse } from "next/server";

export async function GET() {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  return NextResponse.json({
    areas: await listAreasWithWidgets(await requireSiteId()),
    types: Object.entries(WIDGET_TYPES).map(([key, t]) => ({ key, label: t.label })),
  });
}

export async function POST(request: Request) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const body = await parseBody(request, createWidgetSchema);
  if ("error" in body) return body.error;
  try {
    const widget = await addWidget(
      await requireSiteId(),
      body.data.area,
      body.data.type,
      body.data.settings,
    );
    return NextResponse.json({ widget }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
