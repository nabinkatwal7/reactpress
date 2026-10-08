import { getPost } from "@/lib/posts";
import { requireSiteId } from "@/lib/site";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostForm } from "../post-form";

export const instant = false;

type Props = { params: Promise<{ id: string }> };

export default async function EditPostPage({ params }: Props) {
  const { id } = await params;
  const siteId = await requireSiteId();
  const post = await getPost(siteId, id);
  if (!post) notFound();

  const contentText = JSON.stringify(post.content ?? [], null, 2);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/admin/posts" className="text-sm text-neutral-500 hover:underline">
          ← Posts
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit post</h1>
      </div>
      <PostForm
        mode="edit"
        postId={post.id}
        defaults={{
          title: post.title,
          slug: post.slug,
          status: post.status,
          contentText,
        }}
      />
    </main>
  );
}
