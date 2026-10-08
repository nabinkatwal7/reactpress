import { commentCounts, listComments } from "@/lib/comments";
import { requireSiteId } from "@/lib/site";
import { commentStatusSchema } from "@/lib/validations/comment";
import Link from "next/link";
import { deleteCommentAction, setCommentStatusAction } from "./actions";

export const instant = false;

type Props = { searchParams: Promise<{ status?: string }> };

const STATUSES = ["pending", "approved", "spam", "trash"] as const;

export default async function CommentsPage({ searchParams }: Props) {
  const { status: param } = await searchParams;
  const parsed = commentStatusSchema.safeParse(param);
  const status = parsed.success ? parsed.data : undefined;

  const siteId = await requireSiteId();
  const [comments, counts] = await Promise.all([listComments(siteId, status), commentCounts(siteId)]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <p className="text-sm text-neutral-500">Admin</p>
        <h1 className="text-2xl font-semibold tracking-tight">Comments</h1>
      </div>

      <nav className="flex gap-4 text-sm">
        <Link href="/admin/comments" className={status ? "text-neutral-500" : "font-medium"}>
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/comments?status=${s}`}
            className={status === s ? "font-medium" : "text-neutral-500"}
          >
            {s} ({counts[s] ?? 0})
          </Link>
        ))}
      </nav>

      {comments.length === 0 ? (
        <p className="text-sm text-neutral-600">No comments.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 border border-neutral-200">
          {comments.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 px-4 py-3 text-sm">
              <p className="text-neutral-500">
                {c.authorName} &lt;{c.authorEmail}&gt; on{" "}
                <Link href={`/admin/posts/${c.post.id}`} className="underline">
                  {c.post.title}
                </Link>{" "}
                · {c.status}
              </p>
              <p className="whitespace-pre-wrap">{c.content}</p>
              <div className="flex gap-3">
                {STATUSES.filter((s) => s !== c.status).map((s) => (
                  <form key={s} action={setCommentStatusAction.bind(null, c.id, s)}>
                    <button type="submit" className="hover:underline">
                      {s === "approved" ? "Approve" : s === "spam" ? "Spam" : s === "trash" ? "Trash" : "Unapprove"}
                    </button>
                  </form>
                ))}
                {c.status === "trash" ? (
                  <form action={deleteCommentAction.bind(null, c.id)}>
                    <button type="submit" className="text-red-600 hover:underline">
                      Delete permanently
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
