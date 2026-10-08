"use server";

import { auth } from "@/auth";
import { Cap, can } from "@/lib/caps";
import { createPostType, createTaxonomy } from "@/lib/registry";
import { requireSiteId } from "@/lib/site";
import { createPostTypeSchema, createTaxonomySchema } from "@/lib/validations/registry";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireManage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/types");
  if (!(await can(session.user.id, Cap.manageOptions))) redirect("/?error=unauthorized");
}

export async function createPostTypeAction(formData: FormData) {
  await requireManage();
  const parsed = createPostTypeSchema.safeParse({
    key: formData.get("key"),
    label: formData.get("label"),
    singular: formData.get("singular") || undefined,
  });
  if (!parsed.success) return;
  try {
    await createPostType(await requireSiteId(), parsed.data);
  } catch {
    return;
  }
  revalidatePath("/admin/types");
}

export async function createTaxonomyAction(formData: FormData) {
  await requireManage();
  const parsed = createTaxonomySchema.safeParse({
    key: formData.get("key"),
    label: formData.get("label"),
    singular: formData.get("singular") || undefined,
    hierarchical: formData.get("hierarchical") === "on",
  });
  if (!parsed.success) return;
  try {
    await createTaxonomy(await requireSiteId(), parsed.data);
  } catch {
    return;
  }
  revalidatePath("/admin/types");
}
