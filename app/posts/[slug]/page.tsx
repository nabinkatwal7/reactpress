import { listApprovedComments } from "@/lib/comments";
import { prisma } from "@/lib/prisma";
import { requireSiteId, withSiteId } from "@/lib/site";
import { notFound } from "next/navigation";
import { CommentForm } from "./comment-form";

export const instant = false;

type Props = { params: Promise<{ slug: string }> };

/** Minimal public post view; the theme system (later phases) replaces this. */
export default async function PublicPostPage({ params }: Props) {
  const { slug } = await params;
  const siteId = await requireSiteId();
  const post = await prisma.post.findFirst({
    where: withSiteId(siteId, { slug, status: "publish" as const, type: "post" }),
  });
  if (!post) notFound();

  const comments = await listApprovedComments(siteId, post.id);
  const blocks = Array.isArray(post.content) ? (post.content as Record<string, unknown>[]) : [];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 p-8">
      <article className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">{post.title}</h1>
        {blocks.map((b, i) =>
          typeof b.text === "string" ? <p key={i}>{b.text}</p> : null,
        )}
      </article>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Comments ({comments.length})</h2>
        <ul className="flex flex-col gap-3">
          {comments.map((c) => (
            <li key={c.id} className="border border-neutral-200 p-3 text-sm">
              <p className="font-medium">{c.authorName}</p>
              <p className="whitespace-pre-wrap">{c.content}</p>
            </li>
          ))}
        </ul>
        <CommentForm postId={post.id} />
      </section>
    </main>
  );
}
