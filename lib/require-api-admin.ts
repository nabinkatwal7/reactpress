import { auth } from "@/auth";
import { Cap, can, type CapKey } from "@/lib/caps";
import { NextResponse } from "next/server";

type Ok = { userId: string };
type Err = { error: NextResponse };

/** API guard: session + capability. Defaults to access_admin. */
export async function requireApiAdmin(
  capability: CapKey = Cap.accessAdmin,
): Promise<Ok | Err> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const allowed = await can(session.user.id, capability);
  if (!allowed) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { userId: session.user.id };
}

export function isApiError(result: Ok | Err): result is Err {
  return "error" in result;
}
