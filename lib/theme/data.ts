import type { Prisma } from "@prisma/client";
import { toBlocks } from "@/lib/blocks";
import { listApprovedComments } from "@/lib/comments";
import { mediaUrl } from "@/lib/media";
import { prisma } from "@/lib/prisma";
import { getTaxonomy } from "@/lib/registry";
import { getSettings, postPath } from "@/lib/settings";
import type { Paging, PostSummary, TermRef } from "./types";

/** Public (theme-facing) data loaders. Everything is scoped to the site and to published content. */

function excerptOf(content: unknown, max = 200) {
  const text = toBlocks(content)
    .map((b) => ("text" in b ? b.text : ""))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

const summaryInclude = {
  featuredMedia: { select: { path: true } },
  terms: { include: { term: { select: { taxonomy: true, slug: true, name: true } } } },
} satisfies Prisma.PostInclude;

type PostRow = Prisma.PostGetPayload<{ include: typeof summaryInclude }>;

function termRefs(rows: PostRow["terms"]): TermRef[] {
  return rows.map(({ term }) => ({
    taxonomy: term.taxonomy,
    slug: term.slug,
    name: term.name,
    url: `/${term.taxonomy}/${term.slug}`,
  }));
}

function summarise(p: PostRow, postBase: string): PostSummary {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    url: postPath({ post_base: postBase as never }, p.slug),
    excerpt: excerptOf(p.content),
    publishedAt: p.publishedAt,
    featuredUrl: p.featuredMedia ? mediaUrl(p.featuredMedia.path) : null,
    terms: termRefs(p.terms),
  };
}

function paging(total: number, perPage: number, page: number): Paging {
  return { page, pages: Math.max(Math.ceil(total / perPage), 1), total };
}

export async function loadPostList(
  siteId: string,
  opts: { page: number; termId?: string },
): Promise<{ posts: PostSummary[]; paging: Paging }> {
  const settings = await getSettings(siteId);
  const perPage = settings.posts_per_page;
  const where: Prisma.PostWhereInput = {
    siteId,
    type: "post",
    status: "publish",
    ...(opts.termId ? { terms: { some: { termId: opts.termId } } } : {}),
  };
  const page = Math.max(opts.page, 1);
  const [rows, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: summaryInclude,
    }),
    prisma.post.count({ where }),
  ]);
  return {
    posts: rows.map((r) => summarise(r, settings.post_base)),
    paging: paging(total, perPage, page),
  };
}

export async function loadSinglePost(siteId: string, slug: string) {
  const post = await prisma.post.findFirst({
    where: { siteId, slug, status: "publish", type: "post" },
    include: summaryInclude,
  });
  if (!post) return null;
  return {
    post: {
      id: post.id,
      title: post.title,
      type: post.type,
      content: post.content,
      publishedAt: post.publishedAt,
      featuredUrl: post.featuredMedia ? mediaUrl(post.featuredMedia.path) : null,
      terms: termRefs(post.terms),
    },
    comments: await listApprovedComments(siteId, post.id),
  };
}

export async function loadPage(siteId: string, slug: string) {
  const page = await prisma.page.findFirst({ where: { siteId, slug, status: "publish" } });
  return page ? { id: page.id, title: page.title, slug: page.slug, content: page.content } : null;
}

export async function loadPageById(siteId: string, id: string) {
  const page = await prisma.page.findFirst({ where: { siteId, id, status: "publish" } });
  return page ? { id: page.id, title: page.title, slug: page.slug, content: page.content } : null;
}

export async function loadArchive(siteId: string, taxonomyKey: string, termSlug: string, page: number) {
  const taxonomy = await getTaxonomy(siteId, taxonomyKey);
  if (!taxonomy) return null;
  const term = await prisma.term.findFirst({ where: { siteId, taxonomy: taxonomyKey, slug: termSlug } });
  if (!term) return null;
  const list = await loadPostList(siteId, { page, termId: term.id });
  return {
    taxonomy: { key: taxonomy.key, label: taxonomy.label, singular: taxonomy.singular },
    term: { name: term.name, slug: term.slug, description: term.description },
    ...list,
  };
}
