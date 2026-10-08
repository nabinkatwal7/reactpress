import { searchContent } from "@/lib/search";
import { requireSiteId } from "@/lib/site";
import Link from "next/link";

export const instant = false;

type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  const results = q.trim() ? await searchContent(await requireSiteId(), q) : [];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <form action="/search" className="flex gap-2 text-sm">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search…"
          className="flex-1 rounded border border-neutral-300 px-3 py-2"
        />
        <button type="submit" className="rounded bg-neutral-900 px-3 py-2 font-medium text-white">
          Search
        </button>
      </form>

      {q.trim() ? (
        results.length === 0 ? (
          <p className="text-sm text-neutral-600">No results for “{q}”.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {results.map((r) => (
              <li key={`${r.kind}:${r.id}`} className="flex flex-col gap-1 text-sm">
                <Link href={r.url} className="text-lg font-medium underline">
                  {r.title}
                </Link>
                <p
                  className="text-neutral-600"
                  // excerpt is HTML-escaped in lib/search.ts; only <mark> tags are added
                  dangerouslySetInnerHTML={{ __html: r.excerpt }}
                />
              </li>
            ))}
          </ul>
        )
      ) : null}
    </main>
  );
}
