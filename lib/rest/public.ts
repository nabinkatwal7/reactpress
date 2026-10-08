import type { Prisma } from "@prisma/client";
import { toBlocks } from "@/lib/blocks";
import { mediaUrl } from "@/lib/media";
import { withBase } from "@/lib/network/resolve";
import { prisma } from "@/lib/prisma";
import { listTaxonomies } from "@/lib/registry";
import { searchContent } from "@/lib/search";
import { getSettings, postPath } from "@/lib/settings";
import { listBody, sortParams, type Paged } from "./http";

/**
 * Read rules for the public REST API: only published content, and only fields that are already
 * public on the site. Drafts, private and trashed items never appear here; the authenticated
 * admin API (`/api/admin`) is for those. Everything is scoped to one site.
 */

const postInclude = {
  author: { select: { id: true, name: true } },
  featuredMedia: { select: { id: true, path: true, altText: true } },
  terms: { include: { term: { select: { id: true, taxonomy: true, slug: true, name: true } } } },
} satisfies Prisma.PostInclude;

type PostRow = Prisma.PostGetPayload<{ include: typeof postInclude }>;
type PageRow = Prisma.PageGetPayload<{ include: { author: { select: { id: true; name: true } } } }>;

function excerptOf(content: unknown, max = 200) {
  const text = toBlocks(content)
    .map((b) => ("text" in b ? b.text : ""))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export type Ctx = { siteId: string; base: string; postBase: string };

export async function restContext(siteId: string, base: string): Promise<Ctx> {
  return { siteId, base, postBase: (await getSettings(siteId)).post_base };
}

export function serializePost(p: PostRow, c: Ctx) {
  return {
    id: p.id,
    type: p.type,
    slug: p.slug,
    status: p.status,
    title: p.title,
    link: withBase(c.base, postPath({ post_base: c.postBase as never }, p.slug)),
    date: p.publishedAt,
    modified: p.updatedAt,
    author: p.author ? { id: p.author.id, name: p.author.name } : null,
    excerpt: excerptOf(p.content),
    content: toBlocks(p.content),
    featured_media: p.featuredMedia
      ? { id: p.featuredMedia.id, url: mediaUrl(p.featuredMedia.path), alt: p.featuredMedia.altText }
      : null,
    terms: p.terms.map(({ term }) => ({ id: term.id, taxonomy: term.taxonomy, slug: term.slug, name: term.name })),
  };
}

export function serializePage(p: PageRow, c: Ctx) {
  return {
    id: p.id,
    slug: p.slug,
    status: p.status,
    title: p.title,
    link: withBase(c.base, `/${p.slug}`),
    parent_id: p.parentId,
    date: p.publishedAt,
    modified: p.updatedAt,
    author: p.author ? { id: p.author.id, name: p.author.name } : null,
    excerpt: excerptOf(p.content),
    content: toBlocks(p.content),
  };
}

/** Ids matching a text query, best match first (uses the full-text index). */
async function searchIds(siteId: string, q: string, kind: "post" | "page") {
  return (await searchContent(siteId, q, { limit: 50 })).filter((r) => r.kind === kind).map((r) => r.id);
}

export async function listPublicPosts(c: Ctx, sp: URLSearchParams, p: Paged) {
  const q = sp.get("search")?.trim();
  const ids = q ? await searchIds(c.siteId, q, "post") : null;
  const term = sp.get("term");
  const where: Prisma.PostWhereInput = {
    siteId: c.siteId,
    status: "publish",
    type: sp.get("type") ?? "post",
    ...(ids ? { id: { in: ids } } : {}),
    ...(term
      ? { terms: { some: { term: { slug: term, ...(sp.get("taxonomy") ? { taxonomy: sp.get("taxonomy")! } : {}) } } } }
      : {}),
    ...(sp.get("author") ? { authorId: sp.get("author")! } : {}),
  };
  const { orderby, order: dir } = sortParams(sp, ["date", "title", "modified"], "date");
  const orderBy: Prisma.PostOrderByWithRelationInput =
    orderby === "title" ? { title: dir } : orderby === "modified" ? { updatedAt: dir } : { publishedAt: dir };
  const [rows, total] = await Promise.all([
    prisma.post.findMany({ where, orderBy, skip: p.skip, take: p.perPage, include: postInclude }),
    prisma.post.count({ where }),
  ]);
  // keep search relevance order unless an explicit orderby was requested
  if (ids && !sp.get("orderby")) rows.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  return listBody(rows.map((r) => serializePost(r, c)), total, p);
}

/** One published post by id or slug. */
export async function getPublicPost(c: Ctx, idOrSlug: string) {
  const row = await prisma.post.findFirst({
    where: { siteId: c.siteId, status: "publish", OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: postInclude,
  });
  return row ? serializePost(row, c) : null;
}

const pageInclude = { author: { select: { id: true, name: true } } };

export async function listPublicPages(c: Ctx, sp: URLSearchParams, p: Paged) {
  const q = sp.get("search")?.trim();
  const ids = q ? await searchIds(c.siteId, q, "page") : null;
  const where: Prisma.PageWhereInput = {
    siteId: c.siteId,
    status: "publish",
    ...(ids ? { id: { in: ids } } : {}),
    ...(sp.get("parent") ? { parentId: sp.get("parent")! } : {}),
  };
  const { orderby, order: dir } = sortParams(sp, ["date", "title", "modified"], "title");
  const orderBy: Prisma.PageOrderByWithRelationInput =
    orderby === "date" ? { publishedAt: dir } : orderby === "modified" ? { updatedAt: dir } : { title: sp.get("order") ? dir : "asc" };
  const [rows, total] = await Promise.all([
    prisma.page.findMany({ where, orderBy, skip: p.skip, take: p.perPage, include: pageInclude }),
    prisma.page.count({ where }),
  ]);
  return listBody(rows.map((r) => serializePage(r, c)), total, p);
}

export async function getPublicPage(c: Ctx, idOrSlug: string) {
  const row = await prisma.page.findFirst({
    where: { siteId: c.siteId, status: "publish", OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: pageInclude,
  });
  return row ? serializePage(row, c) : null;
}

/** Media is public only while a published post uses it as its featured image. */
const publicMedia = (siteId: string): Prisma.MediaWhereInput => ({
  siteId,
  featuredIn: { some: { status: "publish" } },
});

function serializeMedia(m: { id: string; path: string; mimeType: string; title: string; altText: string; size: number; createdAt: Date }) {
  return { id: m.id, url: mediaUrl(m.path), mime_type: m.mimeType, title: m.title, alt: m.altText, size: m.size, date: m.createdAt };
}

export async function listPublicMedia(c: Ctx, p: Paged) {
  const where = publicMedia(c.siteId);
  const [rows, total] = await Promise.all([
    prisma.media.findMany({ where, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.perPage }),
    prisma.media.count({ where }),
  ]);
  return listBody(rows.map(serializeMedia), total, p);
}

export async function getPublicMedia(c: Ctx, id: string) {
  const row = await prisma.media.findFirst({ where: { ...publicMedia(c.siteId), id } });
  return row ? serializeMedia(row) : null;
}

export async function publicTaxonomies(c: Ctx) {
  return (await listTaxonomies(c.siteId)).map((t) => ({
    key: t.key,
    label: t.label,
    singular: t.singular,
    hierarchical: t.hierarchical,
  }));
}

/** Terms with the number of published posts in each. */
export async function listPublicTerms(c: Ctx, taxonomy: string | null, p: Paged) {
  const where: Prisma.TermWhereInput = { siteId: c.siteId, ...(taxonomy ? { taxonomy } : {}) };
  const [rows, total] = await Promise.all([
    prisma.term.findMany({ where, orderBy: { name: "asc" }, skip: p.skip, take: p.perPage }),
    prisma.term.count({ where }),
  ]);
  const counts = await prisma.postTerm.groupBy({
    by: ["termId"],
    where: { termId: { in: rows.map((r) => r.id) }, post: { status: "publish", siteId: c.siteId } },
    _count: { _all: true },
  });
  const count = new Map(counts.map((x) => [x.termId, x._count._all]));
  return listBody(
    rows.map((t) => ({
      id: t.id,
      taxonomy: t.taxonomy,
      slug: t.slug,
      name: t.name,
      description: t.description ?? "",
      parent_id: t.parentId,
      count: count.get(t.id) ?? 0,
    })),
    total,
    p,
  );
}

/** Public author info: id and display name only, and only for people with published content here. */
const hasPublished = (siteId: string): Prisma.UserWhereInput => ({
  OR: [{ posts: { some: { siteId, status: "publish" } } }, { pages: { some: { siteId, status: "publish" } } }],
});

export async function listPublicUsers(c: Ctx, p: Paged) {
  const where = hasPublished(c.siteId);
  const [rows, total] = await Promise.all([
    prisma.user.findMany({ where, select: { id: true, name: true }, orderBy: { name: "asc" }, skip: p.skip, take: p.perPage }),
    prisma.user.count({ where }),
  ]);
  const counts = await prisma.post.groupBy({
    by: ["authorId"],
    where: { siteId: c.siteId, status: "publish", authorId: { in: rows.map((r) => r.id) } },
    _count: { _all: true },
  });
  const count = new Map(counts.map((x) => [x.authorId, x._count._all]));
  return listBody(rows.map((u) => ({ id: u.id, name: u.name ?? "Anonymous", post_count: count.get(u.id) ?? 0 })), total, p);
}

export async function getPublicUser(c: Ctx, id: string) {
  const u = await prisma.user.findFirst({ where: { id, ...hasPublished(c.siteId) }, select: { id: true, name: true } });
  if (!u) return null;
  const post_count = await prisma.post.count({ where: { siteId: c.siteId, status: "publish", authorId: id } });
  return { id: u.id, name: u.name ?? "Anonymous", post_count };
}
