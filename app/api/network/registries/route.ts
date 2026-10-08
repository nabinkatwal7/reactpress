import { parseBody } from "@/lib/api-json";
import { setRegistries } from "@/lib/marketplace/registries";
import { getDefaultNetwork } from "@/lib/network/sites";
import { requireApiSuperAdmin } from "@/lib/require-super-admin";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET() {
  const gate = await requireApiSuperAdmin();
  if ("error" in gate) return gate.error;
  return NextResponse.json({ registries: (await getDefaultNetwork()).registries });
}

/** Body: { registries: string[] }. Replaces the list. */
export async function PUT(request: Request) {
  const gate = await requireApiSuperAdmin();
  if ("error" in gate) return gate.error;
  const body = await parseBody(request, z.object({ registries: z.array(z.string()) }));
  if ("error" in body) return body.error;
  try {
    return NextResponse.json({ registries: await setRegistries((await getDefaultNetwork()).id, body.data.registries) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
