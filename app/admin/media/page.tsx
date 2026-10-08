import { BulkList } from "@/components/admin/bulk-list";
import { Pagination, SearchBox, withParams } from "@/components/admin/list-controls";
import { PageHeader } from "@/components/admin/page-header";
import { isImage, mediaUrl, queryMedia } from "@/lib/media";
import { requireSiteId } from "@/lib/site";
import Link from "next/link";
import { bulkMediaAction } from "./actions";
import { UploadForm } from "./upload-form";

export const instant = false;

type Props = { searchParams: Promise<{ q?: string; kind?: string; page?: string }> };

export default async function MediaPage({ searchParams }: Props) {
  const sp = await searchParams;
  const kind = sp.kind === "image" || sp.kind === "other" ? sp.kind : undefined;
  const page = Math.max(Number(sp.page) || 1, 1);
  const { items, total, pages } = await queryMedia(await requireSiteId(), { q: sp.q, kind, page });

  const path = "/admin/media";
  const params = { q: sp.q, kind };
  const tab = (label: string, value: string | undefined) => (
    <Link
      key={label}
      href={withParams(path, { q: sp.q, kind: value })}
      className={kind === value ? "font-medium" : "text-neutral-500 hover:underline"}
    >
      {label}
    </Link>
  );

  return (
    <main className="flex flex-1 flex-col gap-4 p-8">
      <PageHeader title="Media" />
      <UploadForm />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav className="flex gap-4 text-sm" aria-label="Filter by type">
          {tab("All", undefined)}
          {tab("Images", "image")}
          {tab("Other files", "other")}
        </nav>
        <SearchBox path={path} params={params} q={sp.q} />
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-600">No media found.</p>
      ) : (
        <BulkList
          layout="grid"
          onApply={bulkMediaAction}
          actions={[{ value: "delete", label: "Delete permanently", confirm: "Delete the selected files? This cannot be undone." }]}
          rows={items.map((m) => ({
            id: m.id,
            node: (
              <>
                <a href={mediaUrl(m.path)} target="_blank" rel="noreferrer">
                  {isImage(m.mimeType) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(m.path)} alt={m.altText} className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="flex aspect-square items-center justify-center bg-neutral-100 text-neutral-500">
                      {m.mimeType}
                    </div>
                  )}
                </a>
                <p className="mt-1 truncate font-medium">{m.filename}</p>
                <p className="text-neutral-500">{Math.ceil(m.size / 1024)} KB</p>
              </>
            ),
          }))}
        />
      )}

      <Pagination path={path} params={params} page={page} pages={pages} total={total} />
    </main>
  );
}
