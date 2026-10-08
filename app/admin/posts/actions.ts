"use server";

import { auth } from "@/auth";
import { Cap, can } from "@/lib/caps";
import { createPost, deletePost, updatePost } from "@/lib/posts";
import { requireSiteId } from "@/lib/site";
import { createPostSchema, updatePostSchema } from "@/lib/validations/post";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireEditPosts() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/posts");
  if (!(await can(session.user.id, Cap.editPosts))) {
    redirect("/?error=unauthorized");
  }
  return session.user.id;
}

export async function createPostAction(input: unknown) {
  const userId = await requireEditPosts();
  const parsed = createPostSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  if ((parsed.data.status === "publish" || parsed.data.status === "scheduled")) {
    if (!(await can(userId, Cap.publishPosts))) {
      return { error: "Missing publish_posts capability" };
    }
  }

  const siteId = await requireSiteId();
  let post;
  try {
    post = await createPost(siteId, userId, parsed.data);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/admin/posts");
  redirect(`/admin/posts/${post.id}`);
}

export async function updatePostAction(id: string, input: unknown) {
  const userId = await requireEditPosts();
  const parsed = updatePostSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  if ((parsed.data.status === "publish" || parsed.data.status === "scheduled")) {
    if (!(await can(userId, Cap.publishPosts))) {
      return { error: "Missing publish_posts capability" };
    }
  }

  const siteId = await requireSiteId();
  let post;
  try {
    post = await updatePost(siteId, id, parsed.data);
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!post) return { error: "Not found" };
  revalidatePath("/admin/posts");
  revalidatePath(`/admin/posts/${id}`);
  return { ok: true };
}

export async function deletePostAction(id: string) {
  await requireEditPosts();
  const siteId = await requireSiteId();
  await deletePost(siteId, id);
  revalidatePath("/admin/posts");
  redirect("/admin/posts");
}
