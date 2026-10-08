"use server";

import { auth } from "@/auth";
import { Cap, can } from "@/lib/caps";
import { createPage, deletePage, updatePage } from "@/lib/pages";
import { requireSiteId } from "@/lib/site";
import { createPageSchema, updatePageSchema } from "@/lib/validations/page";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireEditPages() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/pages");
  if (!(await can(session.user.id, Cap.editPages))) {
    redirect("/?error=unauthorized");
  }
  return session.user.id;
}

export async function createPageAction(input: unknown) {
  const userId = await requireEditPages();
  const parsed = createPageSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  if (parsed.data.status === "publish") {
    if (!(await can(userId, Cap.publishPosts))) {
      return { error: "Missing publish_pages capability" };
    }
  }

  const siteId = await requireSiteId();
  const page = await createPage(siteId, userId, parsed.data);
  revalidatePath("/admin/pages");
  redirect(`/admin/pages/${page.id}`);
}

export async function updatePageAction(id: string, input: unknown) {
  const userId = await requireEditPages();
  const parsed = updatePageSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  if (parsed.data.status === "publish") {
    if (!(await can(userId, Cap.publishPosts))) {
      return { error: "Missing publish_pages capability" };
    }
  }

  const siteId = await requireSiteId();
  const page = await updatePage(siteId, id, parsed.data);
  if (!page) return { error: "Not found" };
  revalidatePath("/admin/pages");
  revalidatePath(`/admin/pages/${id}`);
  return { ok: true };
}

export async function deletePageAction(id: string) {
  await requireEditPages();
  const siteId = await requireSiteId();
  await deletePage(siteId, id);
  revalidatePath("/admin/pages");
  redirect("/admin/pages");
}
