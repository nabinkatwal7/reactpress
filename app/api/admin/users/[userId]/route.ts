import { parseBody } from "@/lib/api-json";
import { Cap } from "@/lib/caps";
import { listMembers, removeMember, setMemberRole } from "@/lib/network/members";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { requireSiteId } from "@/lib/site";
import { NextResponse } from "next/server";
import { z } from "zod";

type Ctx = { params: Promise<{ userId: string }> };

const roleSchema = z.object({ role: z.string().min(1) });

/** Change a member's role on this site. */
export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.manageUsers);
  if (isApiError(gate)) return gate.error;
  const body = await parseBody(request, roleSchema);
  if ("error" in body) return body.error;
  const siteId = await requireSiteId();
  try {
    await setMemberRole(siteId, (await ctx.params).userId, body.data.role);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  return NextResponse.json({ members: await listMembers(siteId) });
}

/** Remove a member from this site (the account stays in the network). */
export async function DELETE(_request: Request, ctx: Ctx) {
  const gate = await requireApiAdmin(Cap.manageUsers);
  if (isApiError(gate)) return gate.error;
  const siteId = await requireSiteId();
  try {
    if (!(await removeMember(siteId, (await ctx.params).userId))) {
      return NextResponse.json({ error: "Not a member" }, { status: 404 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  return NextResponse.json({ members: await listMembers(siteId) });
}
