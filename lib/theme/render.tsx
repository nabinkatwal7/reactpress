import type { ReactElement } from "react";
import { toBlocks } from "@/lib/blocks";
import { withBase } from "@/lib/network/resolve";
import { applyFilters } from "@/lib/hooks";
import { ensurePluginsLoaded } from "@/lib/plugins/loader";
import type { ResolvedMenuItem } from "@/lib/menus";
import { getTaxonomy } from "@/lib/registry";
import { searchContent } from "@/lib/search";
import { getSettings } from "@/lib/settings";
import { requireSiteId } from "@/lib/site";
import { auth } from "@/auth";
import { Cap, can } from "@/lib/caps";
import { buildThemeContext, cssVars } from "./context";
import { getDraft, type CustomizerValues } from "./customizer";
import { loadArchive, loadPage, loadPageById, loadPostList, loadSinglePost } from "./data";
import { getOverrideMap } from "./overrides";
import { getActiveThemeSlug, loadTheme } from "./themes";
import { resolveTemplate, templateCandidates, type HierarchyInfo } from "./hierarchy";
import type { ThemeContext, ThemeModule } from "./types";
import type { ThemeManifest } from "./manifest";

/**
 * Public rendering pipeline. Route files call one of the `render*` functions; those load the
 * data, pick the template from the active theme and wrap it in the theme's header/footer parts.
 */

type Loaded = {
  siteId: string;
  manifest: ThemeManifest;
  module: ThemeModule;
  ctx: ThemeContext;
  /** Per-site template overrides (hierarchy name → template). */
  overrides: Record<string, string>;
  /** Draft customizer values when previewing. */
  draft: CustomizerValues | null;
};

/** The draft to preview, only for signed-in admins who asked for it (`?rp_preview=1`). */
async function previewDraft(siteId: string, manifest: ThemeManifest, wanted: boolean): Promise<CustomizerValues | null> {
  if (!wanted) return null;
  const session = await auth();
  if (!session?.user?.id || !(await can(session.user.id, Cap.manageOptions))) return null;
  return getDraft(siteId, manifest);
}

async function loadActive(preview = false): Promise<Loaded> {
  const siteId = await requireSiteId();
  await ensurePluginsLoaded(siteId);
  const theme = await loadTheme(await getActiveThemeSlug(siteId));
  const draft = await previewDraft(siteId, theme.manifest, preview);
  const ctx = await buildThemeContext(siteId, theme.manifest, { draft });
  return {
    siteId,
    manifest: theme.manifest,
    module: theme.module,
    ctx,
    overrides: await getOverrideMap(siteId, theme.slug),
    draft,
  };
}

function frame(loaded: Loaded, template: string, props: Record<string, unknown>): ReactElement {
  const { module, manifest, ctx } = loaded;
  const Template = module.templates[template] ?? module.templates.index;
  const Header = module.parts.header;
  const Footer = module.parts.footer;
  const vars = cssVars(manifest, ctx.mods);
  const hasColors = Object.keys(vars).length > 0;
  return (
    <div
      data-theme={manifest.slug}
      className="flex min-h-screen flex-1 flex-col"
      style={{
        ...vars,
        ...(hasColors ? { background: "var(--rp-background_color)", color: "var(--rp-text_color)" } : {}),
      }}
    >
      {Header ? <Header ctx={ctx} /> : null}
      <Template ctx={ctx} {...props} />
      {Footer ? <Footer ctx={ctx} /> : null}
    </div>
  );
}

/**
 * Plugin filter points on the data a template receives: `the_title` (string) and `the_content`
 * (blocks), each with `{ kind: "post" | "page", id }` as extra argument.
 */
async function filterEntry(siteId: string, kind: "post" | "page", entry: unknown) {
  if (!entry || typeof entry !== "object") return entry;
  const e = entry as { id: string; title: string; content: unknown };
  const ctx = { kind, id: e.id };
  return {
    ...e,
    title: await applyFilters(siteId, "the_title", e.title, ctx),
    content: await applyFilters(siteId, "the_content", toBlocks(e.content), ctx),
  };
}

type WithUrl = { url: string };
type WithTerms = { terms: WithUrl[] };

/**
 * Site-served-under-a-path support: URLs the data layer builds ("/blog/x", "/category/y") get the
 * site's `/slug` prefix here, once, so every theme and component gets correct links.
 */
function prefixUrls(base: string, props: Record<string, unknown>): Record<string, unknown> {
  if (!base) return props;
  const out = { ...props };
  const fix = <T extends WithUrl>(items: T[]) => items.map((i) => ({ ...i, url: withBase(base, i.url) }));
  if (Array.isArray(props.posts)) out.posts = (props.posts as (WithUrl & WithTerms)[]).map((p) => ({ ...p, url: withBase(base, p.url), terms: fix(p.terms) }));
  if (Array.isArray(props.results)) out.results = fix(props.results as WithUrl[]);
  if (props.post && typeof props.post === "object") {
    const post = props.post as WithTerms;
    if (Array.isArray(post.terms)) out.post = { ...post, terms: fix(post.terms) };
  }
  return out;
}

function prefixMenu(base: string, items: ResolvedMenuItem[]): ResolvedMenuItem[] {
  return base ? items.map((i) => ({ ...i, href: withBase(base, i.href), children: prefixMenu(base, i.children) })) : items;
}

/** Resolve the template through the hierarchy and render it inside the theme frame. */
async function render(loaded: Loaded, info: HierarchyInfo, rawProps: Record<string, unknown>) {
  const base = loaded.ctx.basePath;
  const props = prefixUrls(base, rawProps);
  if (base) {
    loaded.ctx = { ...loaded.ctx, menus: { primary: prefixMenu(base, loaded.ctx.menus.primary), footer: prefixMenu(base, loaded.ctx.menus.footer) } };
  }
  const available = new Set(loaded.manifest.templates.filter((n) => loaded.module.templates[n]));
  const filtered = { ...props };
  if ("post" in props) filtered.post = await filterEntry(loaded.siteId, "post", props.post);
  if ("page" in props) filtered.page = await filterEntry(loaded.siteId, "page", props.page);
  return frame(loaded, resolveTemplate(templateCandidates(info), available, loaded.overrides), filtered);
}

export async function renderHome(page = 1, preview = false): Promise<ReactElement> {
  const loaded = await loadActive(preview);
  const settings = await getSettings(loaded.siteId);
  const mode = loaded.draft?.homepage_mode ?? settings.homepage_mode;
  const pageId = loaded.draft ? loaded.draft.homepage_page_id : settings.homepage_page_id;
  if (mode === "page" && pageId) {
    const p = await loadPageById(loaded.siteId, pageId);
    if (p) return render(loaded, { kind: "front-page", slug: p.slug }, { page: p });
  }
  const list = await loadPostList(loaded.siteId, { page });
  return render(loaded, { kind: "home" }, list);
}

/** Resolve a catch-all path. Returns null when nothing matches (caller should 404). */
export async function renderPath(path: string[], page = 1, preview = false): Promise<ReactElement | null> {
  const siteId = await requireSiteId();
  const settings = await getSettings(siteId);

  if (path.length === 2 && path[0] === settings.post_base) {
    const single = await loadSinglePost(siteId, path[1]);
    if (!single) return null;
    return render(await loadActive(preview), { kind: "single", type: single.post.type, slug: path[1] }, single);
  }

  if (path.length === 1) {
    const p = await loadPage(siteId, path[0]);
    if (!p) return null;
    return render(await loadActive(preview), { kind: "page", slug: p.slug }, { page: p });
  }

  if (path.length === 2 && (await getTaxonomy(siteId, path[0]))) {
    const archive = await loadArchive(siteId, path[0], path[1], page);
    if (!archive) return null;
    return render(await loadActive(preview), { kind: "archive", taxonomy: path[0], term: path[1] }, archive);
  }

  return null;
}

export async function renderSearch(query: string, preview = false): Promise<ReactElement> {
  const loaded = await loadActive(preview);
  const results = query.trim() ? await searchContent(loaded.siteId, query, { limit: 20 }) : [];
  return render(loaded, { kind: "search" }, {
    query,
    results: results.map((r) => ({ kind: r.kind, id: r.id, title: r.title, url: r.url, excerpt: r.excerpt })),
  });
}

export async function renderNotFound(): Promise<ReactElement> {
  return render(await loadActive(), { kind: "404" }, {});
}
