import Link from "next/link";
import { CommentForm } from "@/components/public/comment-form";
import type { ResolvedMenuItem } from "@/lib/menus";
import type { CommentPublic, Paging, PostSummary } from "@/lib/theme/types";

/** Shared building blocks themes can compose. Styling hooks are plain classes; themes wrap them. */

export function MenuList({ items, className }: { items: ResolvedMenuItem[]; className?: string }) {
  return (
    <ul className={className ?? "flex flex-wrap gap-4"}>
      {items.map((item) => (
        <li key={item.id}>
          <Link href={item.href} className="hover:underline">
            {item.label}
          </Link>
          {item.children.length ? <MenuList items={item.children} className="ml-4 flex flex-col gap-1" /> : null}
        </li>
      ))}
    </ul>
  );
}

const dateFmt = (d: Date | null) =>
  d ? d.toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" }) : "";

export function PostList({ posts, empty = "Nothing here yet." }: { posts: PostSummary[]; empty?: string }) {
  if (posts.length === 0) return <p className="opacity-70">{empty}</p>;
  return (
    <ul className="flex flex-col gap-8">
      {posts.map((p) => (
        <li key={p.id} className="flex flex-col gap-2">
          {p.featuredUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.featuredUrl} alt="" className="h-auto max-w-full" />
          ) : null}
          <h2 className="text-xl font-semibold tracking-tight">
            <Link href={p.url} className="hover:underline">
              {p.title}
            </Link>
          </h2>
          <p className="text-sm opacity-60">
            {dateFmt(p.publishedAt)}
            {p.terms.length ? " · " : ""}
            {p.terms.map((t, i) => (
              <span key={t.url}>
                {i ? ", " : ""}
                <Link href={t.url} className="hover:underline">
                  {t.name}
                </Link>
              </span>
            ))}
          </p>
          {p.excerpt ? <p>{p.excerpt}</p> : null}
        </li>
      ))}
    </ul>
  );
}

/** Previous/next links using `?page=`. */
export function Pager({ paging, basePath }: { paging: Paging; basePath: string }) {
  if (paging.pages <= 1) return null;
  const href = (p: number) => (p > 1 ? `${basePath}?page=${p}` : basePath);
  return (
    <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
      {paging.page > 1 ? <Link href={href(paging.page - 1)}>← Newer</Link> : <span />}
      <span className="opacity-60">
        Page {paging.page} of {paging.pages}
      </span>
      {paging.page < paging.pages ? <Link href={href(paging.page + 1)}>Older →</Link> : <span />}
    </nav>
  );
}

export function CommentsSection({ postId, comments }: { postId: string; comments: CommentPublic[] }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Comments ({comments.length})</h2>
      <ul className="flex flex-col gap-3">
        {comments.map((c) => (
          <li key={c.id} className="border border-current/20 p-3 text-sm">
            <p className="font-medium">{c.authorName}</p>
            <p className="whitespace-pre-wrap">{c.content}</p>
          </li>
        ))}
      </ul>
      <CommentForm postId={postId} />
    </section>
  );
}

export function SearchForm({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form action="/search" className="flex gap-2 text-sm" role="search">
      <input
        name="q"
        defaultValue={defaultValue}
        placeholder="Search…"
        className="flex-1 rounded border border-current/30 bg-transparent px-3 py-2"
      />
      <button type="submit" className="rounded border border-current/30 px-3 py-2">
        Search
      </button>
    </form>
  );
}
