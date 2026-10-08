import { parseBody } from "@/lib/api-json";
import { setSuperAdmin } from "@/lib/network/users";
import { requireApiSuperAdmin } from "@/lib/require-super-admin";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ isSuperAdmin: z.boolean() });

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireApiSuperAdmin();
  if ("error" in gate) return gate.error;
  const body = await parseBody(request, schema);
  if ("error" in body) return body.error;
  try {
    await setSuperAdmin((await ctx.params).id, body.data.isSuperAdmin);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
