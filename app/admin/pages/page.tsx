import { listPages } from "@/lib/pages";
import { requireSiteId } from "@/lib/site";
import Link from "next/link";
import { deletePageAction } from "./actions";

export const instant = false;

export default async function AdminPagesPage() {
  const siteId = await requireSiteId();
  const pages = await listPages(siteId);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500">Admin</p>
          <h1 className="text-2xl font-semibold tracking-tight">Pages</h1>
        </div>
        <Link
          href="/admin/pages/new"
          className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
        >
          Add page
        </Link>
      </div>

      {pages.length === 0 ? (
        <p className="text-sm text-neutral-600">No pages yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 border border-neutral-200">
          {pages.map((page) => (
            <li
              key={page.id}
              className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <Link
                  href={`/admin/pages/${page.id}`}
                  className="font-medium hover:underline"
                >
                  {page.title}
                </Link>
                <p className="truncate text-neutral-500">
                  /{page.slug} · {page.status}
                </p>
              </div>
              <form action={deletePageAction.bind(null, page.id)}>
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
