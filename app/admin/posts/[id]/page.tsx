import { PageHeader } from "@/components/admin/page-header";
import { listMedia } from "@/lib/media";
import { getPost } from "@/lib/posts";
import { requireSiteId } from "@/lib/site";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostForm } from "../post-form";

export const instant = false;

function toLocalInput(d: Date) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

type Props = { params: Promise<{ id: string }> };

export default async function EditPostPage({ params }: Props) {
  const { id } = await params;
  const siteId = await requireSiteId();
  const post = await getPost(siteId, id);
  if (!post) notFound();

  const contentText = JSON.stringify(post.content ?? [], null, 2);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader back={{ href: "/admin/posts", label: "Posts" }} title="Edit post" />
      <PostForm
        mode="edit"
        postId={post.id}
        media={(await listMedia(siteId)).map((m) => ({ id: m.id, filename: m.filename }))}
        defaults={{
          title: post.title,
          slug: post.slug,
          status: post.status,
          contentText,
          featuredMediaId: post.featuredMediaId ?? "",
          scheduledAt: post.scheduledAt ? toLocalInput(post.scheduledAt) : "",
        }}
      />
    </main>
  );
}
