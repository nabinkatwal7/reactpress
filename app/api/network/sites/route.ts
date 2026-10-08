import { parseBody } from "@/lib/api-json";
import { createSite, getDefaultNetwork, listSites } from "@/lib/network/sites";
import { requireApiSuperAdmin } from "@/lib/require-super-admin";
import { NextResponse } from "next/server";
import { siteSchema } from "@/lib/validations/site";

export async function GET() {
  const gate = await requireApiSuperAdmin();
  if ("error" in gate) return gate.error;
  return NextResponse.json({ sites: await listSites((await getDefaultNetwork()).id) });
}

export async function POST(request: Request) {
  const gate = await requireApiSuperAdmin();
  if ("error" in gate) return gate.error;
  const body = await parseBody(request, siteSchema);
  if ("error" in body) return body.error;
  try {
    const site = await createSite((await getDefaultNetwork()).id, body.data);
    return NextResponse.json({ site }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
