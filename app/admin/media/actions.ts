"use server";

import { auth } from "@/auth";
import { Cap, can } from "@/lib/caps";
import { bulkDeleteMedia, deleteMedia } from "@/lib/media";
import { requireSiteId } from "@/lib/site";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function deleteMediaAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/media");
  if (!(await can(session.user.id, Cap.uploadFiles))) redirect("/?error=unauthorized");
  await deleteMedia(await requireSiteId(), id);
  revalidatePath("/admin/media");
}

export async function bulkMediaAction(ids: string[], action: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/media");
  if (!(await can(session.user.id, Cap.uploadFiles))) return { error: "Not allowed" };
  if (action !== "delete") return { error: "Unknown action" };
  const count = await bulkDeleteMedia(await requireSiteId(), ids);
  revalidatePath("/admin/media");
  return { count };
}
