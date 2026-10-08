import { auth } from "@/auth";
import { isSuperAdmin } from "@/lib/network/users";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

/** Page guard for network admin: signed in and a super admin. Redirects otherwise. */
export async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/network");
  if (!(await isSuperAdmin(session.user.id))) redirect("/?error=unauthorized");
  return session;
}

/** API guard for network admin routes. */
export async function requireApiSuperAdmin(): Promise<{ userId: string } | { error: NextResponse }> {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!(await isSuperAdmin(session.user.id))) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { userId: session.user.id };
}
