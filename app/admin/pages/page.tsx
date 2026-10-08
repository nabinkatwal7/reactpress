import { BulkList } from "@/components/admin/bulk-list";
import { Pagination, SearchBox, StatusTabs } from "@/components/admin/list-controls";
import { PageHeader, PrimaryLink } from "@/components/admin/page-header";
import { queryPages, statusCounts } from "@/lib/content-list";
import { requireSiteId } from "@/lib/site";
import { pageStatusSchema } from "@/lib/validations/page";
import Link from "next/link";
import { bulkPagesAction } from "./actions";

export const instant = false;

type Props = { searchParams: Promise<{ status?: string; q?: string; page?: string }> };

export default async function AdminPagesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const siteId = await requireSiteId();
  const status = pageStatusSchema.safeParse(sp.status);
  const page = Math.max(Number(sp.page) || 1, 1);

  const [{ items, total, pages }, counts] = await Promise.all([
    queryPages(siteId, { status: status.success ? status.data : undefined, q: sp.q, page }),
    statusCounts(siteId, "page"),
  ]);

  const path = "/admin/pages";
  const params = { status: sp.status, q: sp.q };
  const inTrash = status.success && status.data === "trash";

  return (
    <main className="flex flex-1 flex-col gap-4 p-8">
      <PageHeader title="Pages" actions={<PrimaryLink href="/admin/pages/new">Add new</PrimaryLink>} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <StatusTabs path={path} params={params} counts={counts} active={status.success ? status.data : undefined} />
        <SearchBox path={path} params={params} q={sp.q} />
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-600">No pages found.</p>
      ) : (
        <BulkList
          onApply={bulkPagesAction}
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
          rows={items.map((p) => ({
            id: p.id,
            node: (
              <>
                <Link href={`/admin/pages/${p.id}`} className="font-medium hover:underline">
                  {p.title}
                </Link>
                <p className="truncate text-neutral-500">
                  /{p.slug} · {p.status}
                  {p.parent ? ` · child of ${p.parent.title}` : ""}
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
