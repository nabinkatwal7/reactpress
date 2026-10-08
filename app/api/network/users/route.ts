import { parseBody } from "@/lib/api-json";
import { createNetworkUser } from "@/lib/network/members";
import { requireApiSuperAdmin } from "@/lib/require-super-admin";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ email: z.string(), name: z.string().optional(), password: z.string() });

/** Create a shared network account. Give it a role on a site from that site's Users screen. */
export async function POST(request: Request) {
  const gate = await requireApiSuperAdmin();
  if ("error" in gate) return gate.error;
  const body = await parseBody(request, schema);
  if ("error" in body) return body.error;
  try {
    return NextResponse.json({ user: await createNetworkUser(body.data) }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
