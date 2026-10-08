import { revokeToken } from "@/lib/rest/tokens";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { NextResponse } from "next/server";

/** Revoke one of your tokens. `current` means the token making this request (used by `logout`). */
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireApiAdmin();
  if (isApiError(gate)) return gate.error;
  let { id } = await ctx.params;
  if (id === "current") {
    if (!gate.tokenId) return NextResponse.json({ error: "Not using an API token" }, { status: 400 });
    id = gate.tokenId;
  }
  if (!(await revokeToken(gate.userId, id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
