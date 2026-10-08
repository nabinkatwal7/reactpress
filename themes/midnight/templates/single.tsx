import { Shell } from "../layout";
import { ContentBlocks } from "@/components/content-blocks";
import { CommentsSection } from "@/components/public/parts";
import type { SingleProps } from "@/lib/theme/types";

export default function Single({ post, comments }: SingleProps) {
  return (
    <Shell>
      <article className="flex flex-col gap-5 text-lg leading-relaxed">
        <h1 className="text-4xl font-bold tracking-tight">{post.title}</h1>
        {post.featuredUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.featuredUrl} alt="" className="h-auto max-w-full" />
        ) : null}
        <ContentBlocks content={post.content} />
      </article>
      <CommentsSection postId={post.id} comments={comments} />
    </Shell>
  );
}
