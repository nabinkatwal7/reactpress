"use server";

import { auth } from "@/auth";
import { Cap, can } from "@/lib/caps";
import { deleteComment, setCommentStatus } from "@/lib/comments";
import { requireSiteId } from "@/lib/site";
import { commentStatusSchema } from "@/lib/validations/comment";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireModerator() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/comments");
  if (!(await can(session.user.id, Cap.moderateComments))) redirect("/?error=unauthorized");
}

export async function setCommentStatusAction(id: string, status: string) {
  await requireModerator();
  const parsed = commentStatusSchema.safeParse(status);
  if (!parsed.success) return;
  await setCommentStatus(await requireSiteId(), id, parsed.data);
  revalidatePath("/admin/comments");
}

export async function deleteCommentAction(id: string) {
  await requireModerator();
  await deleteComment(await requireSiteId(), id);
  revalidatePath("/admin/comments");
}
