import { listPosts } from "@/lib/posts";
import { getPostType } from "@/lib/registry";
import { requireSiteId } from "@/lib/site";
import Link from "next/link";
import { deletePostAction } from "./actions";

export const instant = false;

type Props = { searchParams: Promise<{ type?: string; taxonomy?: string; term?: string }> };

export default async function AdminPostsPage({ searchParams }: Props) {
  const { type, taxonomy, term } = await searchParams;
  const siteId = await requireSiteId();
  const posts = await listPosts(siteId, { type, taxonomy, term });

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500">Admin</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {type ? (await getPostType(siteId, type))?.label ?? type : "Posts"}
          </h1>
          {term ? (
            <p className="text-sm text-neutral-500">
              Filtered by {taxonomy ?? "term"}: {term} ·{" "}
              <Link href="/admin/posts" className="underline">
                clear
              </Link>
            </p>
          ) : null}
        </div>
        <Link
          href={type ? `/admin/posts/new?type=${type}` : "/admin/posts/new"}
          className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
        >
          Add post
        </Link>
      </div>

      {posts.length === 0 ? (
        <p className="text-sm text-neutral-600">No posts yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 border border-neutral-200">
          {posts.map((post) => (
            <li
              key={post.id}
              className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <Link
                  href={`/admin/posts/${post.id}`}
                  className="font-medium hover:underline"
                >
                  {post.title}
                </Link>
                <p className="truncate text-neutral-500">
                  /{post.slug} · {post.status}
                </p>
              </div>
              <form action={deletePostAction.bind(null, post.id)}>
                <button
                  type="submit"
                  className="text-red-600 hover:underline"
                >
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
