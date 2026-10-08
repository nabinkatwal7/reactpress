import { Cap, can } from "@/lib/caps";
import { isSuperAdmin } from "@/lib/network/users";
import { prisma } from "@/lib/prisma";
import { isApiError, requireApiAdmin } from "@/lib/require-api-admin";
import { resolveSite } from "@/lib/site";
import { NextResponse } from "next/server";

/** Who am I on this site: used by the CLI to verify a login. */
export async function GET() {
  const gate = await requireApiAdmin();
  if (isApiError(gate)) return gate.error;
  const [user, site, superAdmin] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: gate.userId }, select: { id: true, email: true, name: true } }),
    resolveSite(),
    isSuperAdmin(gate.userId),
  ]);
  const capabilities = (await Promise.all(Object.values(Cap).map(async (c) => ((await can(gate.userId, c)) ? c : null)))).filter(Boolean);
  return NextResponse.json({ user, site: { id: site.id, slug: site.slug, name: site.name }, super_admin: superAdmin, capabilities });
}
