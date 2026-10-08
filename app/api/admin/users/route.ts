import { parseBody } from "@/lib/api-json";
import { Cap } from "@/lib/caps";
import { addMemberByEmail, listMembers } from "@/lib/network/members";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { NextResponse } from "next/server";
import { z } from "zod";

const addSchema = z.object({ email: z.string().min(1), role: z.string().min(1) });

/** Members of the current site and their roles. */
export async function GET() {
  const gate = await requireApiAdmin(Cap.manageUsers);
  if (isApiError(gate)) return gate.error;
  return NextResponse.json({ members: await listMembers(await requireSiteId()) });
}

/** Add an existing network user to this site: { email, role }. */
export async function POST(request: Request) {
  const gate = await requireApiAdmin(Cap.manageUsers);
  if (isApiError(gate)) return gate.error;
  const body = await parseBody(request, addSchema);
  if ("error" in body) return body.error;
  try {
    await addMemberByEmail(await requireSiteId(), body.data.email, body.data.role);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  return NextResponse.json({ members: await listMembers(await requireSiteId()) }, { status: 201 });
}
