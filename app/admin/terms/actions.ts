"use server";

import { auth } from "@/auth";
import { Cap, can } from "@/lib/caps";
import { requireSiteId } from "@/lib/site";
import { isTaxonomy } from "@/lib/taxonomies";
import { createTerm, deleteTerm } from "@/lib/terms";
import { createTermSchema } from "@/lib/validations/term";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireEdit(taxonomy: string) {
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/admin/terms/${taxonomy}`);
  if (!(await can(session.user.id, Cap.editPosts))) redirect("/?error=unauthorized");
}

export async function createTermAction(taxonomy: string, formData: FormData) {
  await requireEdit(taxonomy);
  if (!isTaxonomy(taxonomy)) return;
  const parsed = createTermSchema.safeParse({
    taxonomy,
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return;
  await createTerm(await requireSiteId(), parsed.data);
  revalidatePath(`/admin/terms/${taxonomy}`);
}

export async function deleteTermAction(taxonomy: string, id: string) {
  await requireEdit(taxonomy);
  await deleteTerm(await requireSiteId(), id);
  revalidatePath(`/admin/terms/${taxonomy}`);
}
