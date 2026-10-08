import { prisma } from "@/lib/prisma";

export async function isSuperAdmin(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { isSuperAdmin: true } });
  return u?.isSuperAdmin ?? false;
}

export async function listNetworkUsers() {
  return prisma.user.findMany({
    select: { id: true, name: true, email: true, isSuperAdmin: true, createdAt: true },
    orderBy: [{ isSuperAdmin: "desc" }, { createdAt: "asc" }],
  });
}

/** Grant or revoke super admin. The network must always keep at least one. */
export async function setSuperAdmin(userId: string, value: boolean) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isSuperAdmin: true } });
  if (!user) throw new Error("User not found");
  if (!value && user.isSuperAdmin && (await prisma.user.count({ where: { isSuperAdmin: true } })) <= 1) {
    throw new Error("The network needs at least one super admin");
  }
  await prisma.user.update({ where: { id: userId }, data: { isSuperAdmin: value } });
}
