import Link from "next/link";

type Params = Record<string, string | undefined>;

/** Build a /path?query URL, dropping empty values. */
export function withParams(path: string, params: Params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

const STATUS_LABELS: Record<string, string> = {
  publish: "Published",
  draft: "Drafts",
  scheduled: "Scheduled",
  private: "Private",
  trash: "Trash",
};

/** "All | Published (3) | Drafts (1) | Trash (0)" tabs; All excludes trash. */
export function StatusTabs({
  path,
  params,
  counts,
  active,
}: {
  path: string;
  params: Params;
  counts: Partial<Record<string, number>>;
  active?: string;
}) {
  const all = Object.entries(counts).reduce((n, [s, c]) => n + (s === "trash" ? 0 : (c ?? 0)), 0);
  const tab = (label: string, status: string | undefined, count: number) => (
    <Link
      key={label}
      href={withParams(path, { ...params, status, page: undefined })}
      className={active === status ? "font-medium" : "text-neutral-500 hover:underline"}
    >
      {label} ({count})
    </Link>
  );
  return (
    <nav className="flex flex-wrap gap-4 text-sm" aria-label="Filter by status">
      {tab("All", undefined, all)}
      {Object.keys(STATUS_LABELS)
        .filter((s) => (counts[s] ?? 0) > 0 || active === s)
        .map((s) => tab(STATUS_LABELS[s], s, counts[s] ?? 0))}
    </nav>
  );
}

/** GET search form that preserves other filters as hidden inputs. */
export function SearchBox({ path, params, q }: { path: string; params: Params; q?: string }) {
  return (
    <form action={path} className="flex gap-2 text-sm">
      {Object.entries(params).map(([k, v]) =>
        v && k !== "q" && k !== "page" ? <input key={k} type="hidden" name={k} value={v} /> : null,
      )}
      <input
        name="q"
        defaultValue={q}
        placeholder="Search…"
        className="rounded border border-neutral-300 px-3 py-1.5"
      />
      <button type="submit" className="rounded border border-neutral-300 px-3 py-1.5">
        Search
      </button>
    </form>
  );
}

export function Pagination({
  path,
  params,
  page,
  pages,
  total,
}: {
  path: string;
  params: Params;
  page: number;
  pages: number;
  total: number;
}) {
  if (pages <= 1) return <p className="text-sm text-neutral-500">{total} item(s)</p>;
  const link = (p: number, label: string, enabled: boolean) =>
    enabled ? (
      <Link href={withParams(path, { ...params, page: p > 1 ? String(p) : undefined })} className="underline">
        {label}
      </Link>
    ) : (
      <span className="text-neutral-400">{label}</span>
    );
  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="text-neutral-500">{total} items</span>
      {link(page - 1, "← Previous", page > 1)}
      <span>
        Page {page} of {pages}
      </span>
      {link(page + 1, "Next →", page < pages)}
    </div>
  );
}
