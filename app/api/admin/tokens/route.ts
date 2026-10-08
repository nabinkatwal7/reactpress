import { listTokens } from "@/lib/rest/tokens";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { NextResponse } from "next/server";

/** Your own API tokens (never the token values). */
export async function GET() {
  const gate = await requireApiAdmin();
  if (isApiError(gate)) return gate.error;
  return NextResponse.json({ tokens: await listTokens(gate.userId) });
}
