import { auth } from "@/auth";
import { isSuperAdmin } from "@/lib/network/users";
import { identifyCaller } from "@/lib/require-api-admin";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

/** Page guard for network admin: signed in and a super admin. Redirects otherwise. */
export async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/network");
  if (!(await isSuperAdmin(session.user.id))) redirect("/?error=unauthorized");
  return session;
}

/** API guard for network admin routes (session or API token). */
export async function requireApiSuperAdmin(): Promise<{ userId: string } | { error: NextResponse }> {
  const who = await identifyCaller();
  if (!who || who === "bad-token") {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } }) };
  }
  if (!(await isSuperAdmin(who.userId))) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { userId: who.userId };
}
