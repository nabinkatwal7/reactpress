"use server";

import { auth } from "@/auth";
import { Cap, can } from "@/lib/caps";
import { createMenu, deleteMenu } from "@/lib/menus";
import { requireSiteId } from "@/lib/site";
import { createMenuSchema } from "@/lib/validations/menu";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireManage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/menus");
  if (!(await can(session.user.id, Cap.manageOptions))) redirect("/?error=unauthorized");
}

export async function createMenuAction(formData: FormData) {
  await requireManage();
  const parsed = createMenuSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return;
  const menu = await createMenu(await requireSiteId(), parsed.data.name);
  redirect(`/admin/menus/${menu.id}`);
}

export async function deleteMenuAction(id: string) {
  await requireManage();
  await deleteMenu(await requireSiteId(), id);
  revalidatePath("/admin/menus");
}
