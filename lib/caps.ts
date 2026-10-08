import { prisma } from "@/lib/prisma";

/** Capability keys used across ReactPress (WordPress-style). */
export const Cap = {
  accessAdmin: "access_admin",
  editPosts: "edit_posts",
  publishPosts: "publish_posts",
  editPages: "edit_pages",
  uploadFiles: "upload_files",
  manageOptions: "manage_options",
  manageUsers: "manage_users",
} as const;

export type CapKey = (typeof Cap)[keyof typeof Cap];

type UserLike = { id: string } | string | null | undefined;

function userIdOf(user: UserLike): string | null {
  if (!user) return null;
  return typeof user === "string" ? user : user.id;
}

/** True if the user has the given capability via their role. */
export async function can(user: UserLike, capability: CapKey | string): Promise<boolean> {
  const userId = userIdOf(user);
  if (!userId) return false;

  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: {
        select: {
          capabilities: {
            where: { capability: { key: capability } },
            select: { capabilityId: true },
            take: 1,
          },
        },
      },
    },
  });

  return (row?.role?.capabilities.length ?? 0) > 0;
}
