import { parseBody } from "@/lib/api-json";
import { Cap } from "@/lib/caps";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { CONTENT_EVENTS } from "@/lib/webhooks/events";
import { createWebhook, listWebhooks } from "@/lib/webhooks/webhooks";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().max(100).optional(),
  url: z.string().min(1),
  events: z.array(z.string()).min(1),
});

export async function GET() {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  return NextResponse.json({ webhooks: await listWebhooks(await requireSiteId()), events: CONTENT_EVENTS });
}

/** Create a webhook. The response includes its signing `secret`, shown only this once. */
export async function POST(request: Request) {
  const gate = await requireApiAdmin(Cap.manageOptions);
  if (isApiError(gate)) return gate.error;
  const body = await parseBody(request, createSchema);
  if ("error" in body) return body.error;
  try {
    return NextResponse.json({ webhook: await createWebhook(await requireSiteId(), body.data) }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
