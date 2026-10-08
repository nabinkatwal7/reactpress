import type { ReactElement } from "react";
import { getTaxonomy } from "@/lib/registry";
import { searchContent } from "@/lib/search";
import { getSettings } from "@/lib/settings";
import { requireSiteId } from "@/lib/site";
import { buildThemeContext, cssVars } from "./context";
import { loadArchive, loadPage, loadPageById, loadPostList, loadSinglePost } from "./data";
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
};

async function loadActive(): Promise<Loaded> {
  const siteId = await requireSiteId();
  const theme = await loadTheme(await getActiveThemeSlug(siteId));
  const ctx = await buildThemeContext(siteId, theme.manifest);
  return { siteId, manifest: theme.manifest, module: theme.module, ctx, overrides: {} };
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

/** Resolve the template through the hierarchy and render it inside the theme frame. */
function render(loaded: Loaded, info: HierarchyInfo, props: Record<string, unknown>) {
  const available = new Set(loaded.manifest.templates.filter((n) => loaded.module.templates[n]));
  return frame(loaded, resolveTemplate(templateCandidates(info), available, loaded.overrides), props);
}

export async function renderHome(page = 1): Promise<ReactElement> {
  const loaded = await loadActive();
  const settings = await getSettings(loaded.siteId);
  if (settings.homepage_mode === "page" && settings.homepage_page_id) {
    const p = await loadPageById(loaded.siteId, settings.homepage_page_id);
    if (p) return render(loaded, { kind: "front-page", slug: p.slug }, { page: p });
  }
  const list = await loadPostList(loaded.siteId, { page });
  return render(loaded, { kind: "home" }, list);
}

/** Resolve a catch-all path. Returns null when nothing matches (caller should 404). */
export async function renderPath(path: string[], page = 1): Promise<ReactElement | null> {
  const siteId = await requireSiteId();
  const settings = await getSettings(siteId);

  if (path.length === 2 && path[0] === settings.post_base) {
    const single = await loadSinglePost(siteId, path[1]);
    if (!single) return null;
    return render(await loadActive(), { kind: "single", type: single.post.type, slug: path[1] }, single);
  }

  if (path.length === 1) {
    const p = await loadPage(siteId, path[0]);
    if (!p) return null;
    return render(await loadActive(), { kind: "page", slug: p.slug }, { page: p });
  }

  if (path.length === 2 && (await getTaxonomy(siteId, path[0]))) {
    const archive = await loadArchive(siteId, path[0], path[1], page);
    if (!archive) return null;
    return render(await loadActive(), { kind: "archive", taxonomy: path[0], term: path[1] }, archive);
  }

  return null;
}

export async function renderSearch(query: string): Promise<ReactElement> {
  const loaded = await loadActive();
  const results = query.trim() ? await searchContent(loaded.siteId, query, { limit: 20 }) : [];
  return render(loaded, { kind: "search" }, {
    query,
    results: results.map((r) => ({ kind: r.kind, id: r.id, title: r.title, url: r.url, excerpt: r.excerpt })),
  });
}

export async function renderNotFound(): Promise<ReactElement> {
  return render(await loadActive(), { kind: "404" }, {});
}
