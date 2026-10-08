import { prisma } from "@/lib/prisma";
import { getSettings, postPath } from "@/lib/settings";

export type SearchResult = {
  kind: "post" | "page";
  id: string;
  title: string;
  slug: string;
  url: string;
  rank: number;
  /** Snippet with matches wrapped in <mark>…</mark>; text is HTML-escaped by us first. */
  excerpt: string;
};

type Row = {
  kind: "post" | "page";
  id: string;
  title: string;
  slug: string;
  rank: number;
  excerpt: string;
};

const MAX_QUERY_LENGTH = 200;

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Ranked full-text search over published posts and pages.
 * websearch_to_tsquery accepts any user input without syntax errors ("quoted phrases", -exclude, or).
 */
export async function searchContent(
  siteId: string,
  rawQuery: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<SearchResult[]> {
  const q = rawQuery.trim().slice(0, MAX_QUERY_LENGTH);
  if (!q) return [];
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 50);
  const offset = Math.max(opts.offset ?? 0, 0);

  // Headlines use private delimiters so we can HTML-escape the text and then restore <mark>.
  const opt = "StartSel=\u0001,StopSel=\u0002,MaxWords=30,MinWords=12,ShortWord=2";

  const rows = await prisma.$queryRaw<Row[]>`
    WITH query AS (SELECT websearch_to_tsquery('english', ${q}) AS tsq)
    SELECT * FROM (
      SELECT 'post' AS kind, p.id, p.title, p.slug,
             ts_rank_cd(p."searchVector", query.tsq)::float8 AS rank,
             ts_headline('english', p.title || ' ' || rp_blocks_text(p.content), query.tsq, ${opt}) AS excerpt
      FROM "Post" p, query
      WHERE p."siteId" = ${siteId} AND p.status = 'publish' AND p.type = 'post'
        AND p."searchVector" @@ query.tsq
      UNION ALL
      SELECT 'page' AS kind, g.id, g.title, g.slug,
             ts_rank_cd(g."searchVector", query.tsq)::float8 AS rank,
             ts_headline('english', g.title || ' ' || rp_blocks_text(g.content), query.tsq, ${opt}) AS excerpt
      FROM "Page" g, query
      WHERE g."siteId" = ${siteId} AND g.status = 'publish'
        AND g."searchVector" @@ query.tsq
    ) hits
    ORDER BY rank DESC, title ASC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const settings = await getSettings(siteId);
  return rows.map((r) => ({
    ...r,
    url: r.kind === "post" ? postPath(settings, r.slug) : `/${r.slug}`,
    excerpt: escapeHtml(r.excerpt).replace(/\u0001/g, "<mark>").replace(/\u0002/g, "</mark>"),
  }));
}
