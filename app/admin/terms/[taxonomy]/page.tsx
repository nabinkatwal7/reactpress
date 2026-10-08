import { getTaxonomy } from "@/lib/registry";
import { requireSiteId } from "@/lib/site";
import { listTerms } from "@/lib/terms";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createTermAction, deleteTermAction } from "../actions";

export const instant = false;

type Props = { params: Promise<{ taxonomy: string }> };

export default async function TermsPage({ params }: Props) {
  const { taxonomy } = await params;
  const siteId = await requireSiteId();
  const meta = await getTaxonomy(siteId, taxonomy);
  if (!meta) notFound();
  const terms = await listTerms(siteId, taxonomy);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <p className="text-sm text-neutral-500">Admin</p>
        <h1 className="text-2xl font-semibold tracking-tight">{meta.label}</h1>
      </div>

      <form
        action={createTermAction.bind(null, taxonomy)}
        className="flex max-w-xl flex-col gap-2 text-sm"
      >
        <input
          name="name"
          required
          placeholder={`${meta.singular} name`}
          className="rounded border border-neutral-300 px-3 py-2"
        />
        <input
          name="description"
          placeholder="Description (optional)"
          className="rounded border border-neutral-300 px-3 py-2"
        />
        <button
          type="submit"
          className="w-fit rounded bg-neutral-900 px-3 py-2 font-medium text-white"
        >
          Add {meta.singular.toLowerCase()}
        </button>
      </form>

      {terms.length === 0 ? (
        <p className="text-sm text-neutral-600">None yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 border border-neutral-200">
          {terms.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <div>
                <Link
                  href={`/admin/posts?taxonomy=${taxonomy}&term=${t.slug}`}
                  className="font-medium hover:underline"
                >
                  {t.name}
                </Link>
                <p className="text-neutral-500">
                  /{t.slug} · {t._count.posts} posts
                </p>
              </div>
              <form action={deleteTermAction.bind(null, taxonomy, t.id)}>
                <button type="submit" className="text-red-600 hover:underline">
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
