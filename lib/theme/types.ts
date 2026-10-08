import type { ComponentType } from "react";
import type { Block } from "@/lib/blocks";
import type { ResolvedMenuItem } from "@/lib/menus";
import type { PartName } from "@/lib/theme/manifest";

export type ModValue = string | boolean;

/** Everything a template or part may need that is not specific to one page. */
export type ThemeContext = {
  site: { title: string; tagline: string };
  theme: { slug: string };
  /** Customizer values (defaults merged with the site's saved values). */
  mods: Record<string, ModValue>;
  menus: { primary: ResolvedMenuItem[]; footer: ResolvedMenuItem[] };
  /** Site-edited content for template parts (block JSON), when the site has customised one. */
  partContent: Partial<Record<PartName, Block[]>>;
  postBase: string;
  /** "" normally; "/slug" when the site is served under a path prefix. Prefix hard-coded internal links with it (or use SiteLink). */
  basePath: string;
  /** True when rendering unpublished customizer changes for an admin. */
  preview: boolean;
};

export type TermRef = { taxonomy: string; slug: string; name: string; url: string };

export type PostSummary = {
  id: string;
  title: string;
  slug: string;
  url: string;
  excerpt: string;
  publishedAt: Date | null;
  featuredUrl: string | null;
  terms: TermRef[];
};

export type CommentPublic = {
  id: string;
  parentId: string | null;
  authorName: string;
  content: string;
  createdAt: Date;
};

export type Paging = { page: number; pages: number; total: number };

export type HomeProps = { ctx: ThemeContext; posts: PostSummary[]; paging: Paging };
export type SingleProps = {
  ctx: ThemeContext;
  post: {
    id: string;
    title: string;
    type: string;
    content: unknown;
    publishedAt: Date | null;
    featuredUrl: string | null;
    terms: TermRef[];
  };
  comments: CommentPublic[];
};
export type PageProps = { ctx: ThemeContext; page: { id: string; title: string; slug: string; content: unknown } };
export type ArchiveProps = {
  ctx: ThemeContext;
  taxonomy: { key: string; label: string; singular: string };
  term: { name: string; slug: string; description: string | null };
  posts: PostSummary[];
  paging: Paging;
};
export type SearchProps = {
  ctx: ThemeContext;
  query: string;
  results: { kind: "post" | "page"; id: string; title: string; url: string; excerpt: string }[];
};
export type NotFoundProps = { ctx: ThemeContext };

export type TemplateKind = "home" | "single" | "page" | "archive" | "search" | "404";

export type PartProps = { ctx: ThemeContext };

/**
 * What a theme's `index.ts` default-exports. Components are keyed by the names declared
 * in theme.json; props depend on the page kind the template is rendered for.
 */
export type ThemeModule = {
  // props differ per kind, so templates are loosely typed here and strictly typed in each theme file
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  templates: Record<string, ComponentType<any>>;
  parts: Partial<Record<PartName, ComponentType<PartProps>>>;
};
