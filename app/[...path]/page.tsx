import { ContentBlocks } from "@/components/content-blocks";
import { listApprovedComments } from "@/lib/comments";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { requireSiteId, withSiteId } from "@/lib/site";
import { notFound } from "next/navigation";
import { CommentForm } from "./comment-form";

export const instant = false;

type Props = { params: Promise<{ path: string[] }> };

/**
 * Minimal public router (theme template hierarchy replaces this later):
 *   /<post_base>/<slug>  → post (post_base comes from the permalink setting)
 *   /<slug>              → page
 */
export default async function PublicContentPage({ params }: Props) {
  const { path } = await params;
  const siteId = await requireSiteId();
  const settings = await getSettings(siteId);

  if (path.length === 2 && path[0] === settings.post_base) {
    const post = await prisma.post.findFirst({
      where: withSiteId(siteId, { slug: path[1], status: "publish" as const, type: "post" }),
    });
    if (!post) notFound();

    const comments = await listApprovedComments(siteId, post.id);
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 p-8">
        <article className="flex flex-col gap-4">
          <h1 className="text-3xl font-semibold tracking-tight">{post.title}</h1>
          <ContentBlocks content={post.content} />
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

  if (path.length === 1) {
    const page = await prisma.page.findFirst({
      where: withSiteId(siteId, { slug: path[0], status: "publish" as const }),
    });
    if (!page) notFound();

    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-8">
        <h1 className="text-3xl font-semibold tracking-tight">{page.title}</h1>
        <ContentBlocks content={page.content} />
      </main>
    );
  }

  notFound();
}
