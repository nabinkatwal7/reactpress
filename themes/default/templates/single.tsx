import Link from "next/link";
import { Content } from "../layout";
import { ContentBlocks } from "@/components/content-blocks";
import { CommentsSection } from "@/components/public/parts";
import type { SingleProps } from "@/lib/theme/types";

export default function Single({ post, comments }: SingleProps) {
  return (
    <Content>
      <article className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">{post.title}</h1>
        <p className="text-sm opacity-60">
          {post.publishedAt?.toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" })}
          {post.terms.map((t) => (
            <span key={t.url}>
              {" · "}
              <Link href={t.url} className="hover:underline">
                {t.name}
              </Link>
            </span>
          ))}
        </p>
        {post.featuredUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.featuredUrl} alt="" className="h-auto max-w-full" />
        ) : null}
        <ContentBlocks content={post.content} />
      </article>
      <CommentsSection postId={post.id} comments={comments} />
    </Content>
  );
}
