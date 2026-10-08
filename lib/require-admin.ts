import { auth } from "@/auth";
import { Cap, can } from "@/lib/caps";
import { redirect } from "next/navigation";

/** Require a signed-in user with `access_admin`. Redirects otherwise. */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin");
  }

  const allowed = await can(session.user.id, Cap.accessAdmin);
  if (!allowed) {
    redirect("/?error=unauthorized");
  }

  return session;
}
