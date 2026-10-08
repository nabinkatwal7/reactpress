import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * Per-site membership. Users are shared across the network; a user's role (and therefore what
 * `can()` allows) is looked up on the site they are working in.
 */

export async function listRoles() {
  return prisma.role.findMany({ select: { key: true, name: true }, orderBy: { name: "asc" } });
}

export async function listMembers(siteId: string) {
  const rows = await prisma.siteMember.findMany({
    where: { siteId },
    include: { user: { select: { id: true, name: true, email: true, isSuperAdmin: true } }, role: { select: { key: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((m) => ({ ...m.user, role: m.role.key, roleName: m.role.name }));
}

async function roleByKey(key: string) {
  const role = await prisma.role.findUnique({ where: { key } });
  if (!role) throw new Error("Unknown role");
  return role;
}

async function adminCount(siteId: string) {
  return prisma.siteMember.count({ where: { siteId, role: { key: "administrator" } } });
}

/** Give an existing network user a role on a site (adds them, or changes their role). */
export async function setMemberRole(siteId: string, userId: string, roleKey: string) {
  const [role, user, existing] = await Promise.all([
    roleByKey(roleKey),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
    prisma.siteMember.findUnique({ where: { siteId_userId: { siteId, userId } }, include: { role: true } }),
  ]);
  if (!user) throw new Error("User not found");
  if (existing?.role.key === "administrator" && role.key !== "administrator" && (await adminCount(siteId)) <= 1) {
    throw new Error("A site needs at least one administrator");
  }
  return prisma.siteMember.upsert({
    where: { siteId_userId: { siteId, userId } },
    update: { roleId: role.id },
    create: { siteId, userId, roleId: role.id },
  });
}

export async function addMemberByEmail(siteId: string, email: string, roleKey: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
  if (!user) throw new Error("No user with that email in this network");
  return setMemberRole(siteId, user.id, roleKey);
}

export async function removeMember(siteId: string, userId: string) {
  const existing = await prisma.siteMember.findUnique({ where: { siteId_userId: { siteId, userId } }, include: { role: true } });
  if (!existing) return false;
  if (existing.role.key === "administrator" && (await adminCount(siteId)) <= 1) {
    throw new Error("A site needs at least one administrator");
  }
  await prisma.siteMember.delete({ where: { siteId_userId: { siteId, userId } } });
  return true;
}

/** Network-level user creation (shared account; give it a role on a site afterwards). */
export async function createNetworkUser(input: { email: string; name?: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address");
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters");
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) throw new Error("That email is already registered");
  return prisma.user.create({
    data: { email, name: input.name?.trim() || null, passwordHash: await bcrypt.hash(input.password, 10) },
    select: { id: true, email: true, name: true },
  });
}

/** Sites a user can work on: every site for super admins, otherwise the ones they are a member of. */
export async function sitesForUser(userId: string, isSuper: boolean) {
  const where = isSuper ? {} : { members: { some: { userId } } };
  return prisma.site.findMany({ where, select: { slug: true, name: true }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] });
}

/** Roles a user holds across sites, for the network users table. */
export async function membershipsByUser() {
  const rows = await prisma.siteMember.findMany({
    select: { userId: true, site: { select: { name: true } }, role: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const out = new Map<string, string[]>();
  for (const r of rows) out.set(r.userId, [...(out.get(r.userId) ?? []), `${r.site.name}: ${r.role.name}`]);
  return out;
}
