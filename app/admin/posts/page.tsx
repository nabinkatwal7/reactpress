import { BulkList } from "@/components/admin/bulk-list";
import { Pagination, SearchBox, StatusTabs } from "@/components/admin/list-controls";
import { PageHeader, PrimaryLink } from "@/components/admin/page-header";
import { queryPosts, statusCounts } from "@/lib/content-list";
import { getPostType } from "@/lib/registry";
import { requireSiteId } from "@/lib/site";
import { postStatusSchema } from "@/lib/validations/post";
import Link from "next/link";
import { bulkPostsAction } from "./actions";

export const instant = false;

type Props = {
  searchParams: Promise<{
    type?: string;
    status?: string;
    q?: string;
    page?: string;
    taxonomy?: string;
    term?: string;
  }>;
};

export default async function AdminPostsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const siteId = await requireSiteId();
  const type = sp.type ?? "post";
  const status = postStatusSchema.safeParse(sp.status);
  const page = Math.max(Number(sp.page) || 1, 1);

  const [{ items, total, pages }, counts, typeDef] = await Promise.all([
    queryPosts(siteId, {
      type,
      status: status.success ? status.data : undefined,
      q: sp.q,
      taxonomy: sp.taxonomy,
      term: sp.term,
      page,
    }),
    statusCounts(siteId, "post", type),
    getPostType(siteId, type),
  ]);

  const path = "/admin/posts";
  const params = { type: sp.type, status: sp.status, q: sp.q, taxonomy: sp.taxonomy, term: sp.term };
  const inTrash = status.success && status.data === "trash";

  return (
    <main className="flex flex-1 flex-col gap-4 p-8">
      <PageHeader
        title={typeDef?.label ?? "Posts"}
        actions={<PrimaryLink href={sp.type ? `/admin/posts/new?type=${sp.type}` : "/admin/posts/new"}>Add new</PrimaryLink>}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <StatusTabs path={path} params={params} counts={counts} active={status.success ? status.data : undefined} />
        <SearchBox path={path} params={params} q={sp.q} />
      </div>

      {sp.term ? (
        <p className="text-sm text-neutral-500">
          Filtered by {sp.taxonomy ?? "term"}: {sp.term} ·{" "}
          <Link href={{ pathname: path, query: { ...params, taxonomy: undefined, term: undefined } }} className="underline">
            clear
          </Link>
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm text-neutral-600">No posts found.</p>
      ) : (
        <BulkList
          onApply={bulkPostsAction}
          actions={
            inTrash
              ? [
                  { value: "restore", label: "Restore to draft" },
                  { value: "delete", label: "Delete permanently", confirm: "Permanently delete the selected items?" },
                ]
              : [
                  { value: "publish", label: "Publish" },
                  { value: "draft", label: "Move to draft" },
                  { value: "trash", label: "Move to trash" },
                ]
          }
          rows={items.map((post) => ({
            id: post.id,
            node: (
              <>
                <Link href={`/admin/posts/${post.id}`} className="font-medium hover:underline">
                  {post.title}
                </Link>
                <p className="truncate text-neutral-500">
                  /{post.slug} · {post.status} · {post.author?.name ?? post.author?.email ?? "—"}
                  {post.terms.length ? ` · ${post.terms.map((t) => t.term.name).join(", ")}` : ""}
                </p>
              </>
            ),
          }))}
        />
      )}

      <Pagination path={path} params={params} page={page} pages={pages} total={total} />
    </main>
  );
}
