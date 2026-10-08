import { auth } from "@/auth";
import { Cap, can, type CapKey } from "@/lib/caps";
import { TOKEN_PREFIX, verifyToken } from "@/lib/rest/tokens";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

type Ok = { userId: string; /** Set when the request authenticated with an API token. */ tokenId?: string };
type Err = { error: NextResponse };

/** Who is calling: an API token (`Authorization: Bearer rp_…`) or the signed-in session. */
async function identify(): Promise<Ok | "bad-token" | null> {
  const header = (await headers()).get("authorization");
  if (header) {
    const [scheme, token] = header.split(/\s+/);
    if (scheme?.toLowerCase() === "bearer" && token?.startsWith(TOKEN_PREFIX)) {
      // a bearer token that does not check out is an error, never a silent fall back to cookies
      return (await verifyToken(token)) ?? "bad-token";
    }
  }
  const session = await auth();
  return session?.user?.id ? { userId: session.user.id } : null;
}

/**
 * API guard: session or API token, plus a capability on the current site. Defaults to access_admin.
 * Token requests carry no cookies, so they are not exposed to CSRF.
 */
export async function requireApiAdmin(capability: CapKey = Cap.accessAdmin): Promise<Ok | Err> {
  const who = await identify();
  if (!who || who === "bad-token") {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } }) };
  }

  if (!(await can(who.userId, capability))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return who;
}

export function isApiError(result: Ok | Err): result is Err {
  return "error" in result;
}
