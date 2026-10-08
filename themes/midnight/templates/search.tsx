import Link from "next/link";
import { Shell } from "../layout";
import { SearchForm } from "@/components/public/parts";
import type { SearchProps } from "@/lib/theme/types";

export default function Search({ query, results }: SearchProps) {
  return (
    <Shell>
      <SearchForm defaultValue={query} />
      {query && results.length === 0 ? <p className="opacity-70">No results for “{query}”.</p> : null}
      <ul className="flex flex-col gap-5">
        {results.map((r) => (
          <li key={`${r.kind}:${r.id}`} className="flex flex-col gap-1 text-sm">
            <Link href={r.url} className="text-lg font-semibold underline">
              {r.title}
            </Link>
            {/* excerpt is HTML-escaped in lib/search.ts; only <mark> tags are added */}
            <p className="opacity-80" dangerouslySetInnerHTML={{ __html: r.excerpt }} />
          </li>
        ))}
      </ul>
    </Shell>
  );
}
