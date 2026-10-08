"use server";

import { auth, signOut } from "@/auth";
import { Cap, can } from "@/lib/caps";
import { createPost } from "@/lib/posts";
import { requireSiteId } from "@/lib/site";
import { revalidatePath } from "next/cache";

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

export type QuickDraftState = { error?: string; savedId?: string };

/** Dashboard "Quick Draft": title plus optional text saved as a draft post. */
export async function quickDraftAction(
  _prev: QuickDraftState,
  formData: FormData,
): Promise<QuickDraftState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not signed in" };
  if (!(await can(session.user.id, Cap.editPosts))) return { error: "Not allowed" };

  const title = String(formData.get("title") ?? "").trim();
  const text = String(formData.get("content") ?? "").trim();
  if (!title) return { error: "Title is required" };

  const post = await createPost(await requireSiteId(), session.user.id, {
    title,
    status: "draft",
    content: text
      ? text.split(/\n{2,}/).map((p) => ({ type: "paragraph", text: p.trim() }))
      : [],
  });
  revalidatePath("/admin");
  revalidatePath("/admin/posts");
  return { savedId: post.id };
}
