import { NextResponse } from "next/server";

/** Shared helpers for the REST API. */

export const MAX_PER_PAGE = 100;

export const PUBLIC_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60",
};

export function preflight() {
  return new NextResponse(null, { status: 204, headers: PUBLIC_HEADERS });
}

export function publicJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PUBLIC_HEADERS });
}

export function publicError(status: number, message: string) {
  // errors are never cached
  return NextResponse.json({ error: message }, { status, headers: { ...PUBLIC_HEADERS, "Cache-Control": "no-store" } });
}

export type Paged = { page: number; perPage: number; skip: number };

/** `?page=` (1-based) and `?per_page=` (1-100, default 10). Bad values fall back to defaults. */
export function pageParams(sp: URLSearchParams, defaultPerPage = 10): Paged {
  const page = Math.max(Math.trunc(Number(sp.get("page"))) || 1, 1);
  const perPage = Math.min(Math.max(Math.trunc(Number(sp.get("per_page"))) || defaultPerPage, 1), MAX_PER_PAGE);
  return { page, perPage, skip: (page - 1) * perPage };
}

export function listBody<T>(data: T[], total: number, p: Paged) {
  return { data, meta: { total, page: p.page, per_page: p.perPage, pages: Math.max(Math.ceil(total / p.perPage), 1) } };
}

export function sortParams(sp: URLSearchParams, allowed: readonly string[], fallback: string) {
  const orderby = allowed.includes(sp.get("orderby") ?? "") ? (sp.get("orderby") as string) : fallback;
  return { orderby, order: (sp.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc" };
}
