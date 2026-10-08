import { prisma } from "@/lib/prisma";
import { requireSiteId } from "@/lib/site";

/** Capability keys used across ReactPress (WordPress-style). */
export const Cap = {
  accessAdmin: "access_admin",
  editPosts: "edit_posts",
  publishPosts: "publish_posts",
  editPages: "edit_pages",
  uploadFiles: "upload_files",
  moderateComments: "moderate_comments",
  manageOptions: "manage_options",
  manageUsers: "manage_users",
} as const;

export type CapKey = (typeof Cap)[keyof typeof Cap];

type UserLike = { id: string } | string | null | undefined;

function userIdOf(user: UserLike): string | null {
  if (!user) return null;
  return typeof user === "string" ? user : user.id;
}

/**
 * True if the user has the capability on a site. Super admins have every capability everywhere;
 * everyone else gets the capabilities of their role on that site (SiteMember). `siteId` defaults
 * to the site serving the current request.
 */
export async function can(user: UserLike, capability: CapKey | string, siteId?: string): Promise<boolean> {
  const userId = userIdOf(user);
  if (!userId) return false;

  const row = await prisma.user.findUnique({ where: { id: userId }, select: { isSuperAdmin: true } });
  if (!row) return false;
  if (row.isSuperAdmin) return true;

  const member = await prisma.siteMember.findUnique({
    where: { siteId_userId: { siteId: siteId ?? (await requireSiteId()), userId } },
    select: { role: { select: { capabilities: { where: { capability: { key: capability } }, select: { capabilityId: true }, take: 1 } } } },
  });
  return (member?.role.capabilities.length ?? 0) > 0;
}
