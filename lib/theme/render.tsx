import type { ReactElement } from "react";
import { getTaxonomy } from "@/lib/registry";
import { searchContent } from "@/lib/search";
import { getSettings } from "@/lib/settings";
import { requireSiteId } from "@/lib/site";
import { buildThemeContext, cssVars } from "./context";
import { loadArchive, loadPage, loadPageById, loadPostList, loadSinglePost } from "./data";
import { getActiveThemeSlug, loadTheme } from "./themes";
import type { TemplateKind, ThemeContext, ThemeModule } from "./types";
import type { ThemeManifest } from "./manifest";

/**
 * Public rendering pipeline. Route files call one of the `render*` functions; those load the
 * data, pick the template from the active theme and wrap it in the theme's header/footer parts.
 */

type Loaded = { siteId: string; manifest: ThemeManifest; module: ThemeModule; ctx: ThemeContext };

async function loadActive(): Promise<Loaded> {
  const siteId = await requireSiteId();
  const theme = await loadTheme(await getActiveThemeSlug(siteId));
  const ctx = await buildThemeContext(siteId, theme.manifest);
  return { siteId, manifest: theme.manifest, module: theme.module, ctx };
}

/** Template to use for a page kind. Hierarchy resolution replaces this in lib/theme/hierarchy.ts. */
function pickTemplate(loaded: Loaded, candidates: string[]): string {
  const found = candidates.find((n) => loaded.manifest.templates.includes(n) && loaded.module.templates[n]);
  return found ?? "index";
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

function render(loaded: Loaded, kind: TemplateKind, props: Record<string, unknown>, extra: string[] = []) {
  return frame(loaded, pickTemplate(loaded, [...extra, kind, "index"]), props);
}

export async function renderHome(page = 1): Promise<ReactElement> {
  const loaded = await loadActive();
  const settings = await getSettings(loaded.siteId);
  if (settings.homepage_mode === "page" && settings.homepage_page_id) {
    const p = await loadPageById(loaded.siteId, settings.homepage_page_id);
    if (p) return render(loaded, "page", { page: p });
  }
  const list = await loadPostList(loaded.siteId, { page });
  return render(loaded, "home", list);
}

/** Resolve a catch-all path. Returns null when nothing matches (caller should 404). */
export async function renderPath(path: string[], page = 1): Promise<ReactElement | null> {
  const siteId = await requireSiteId();
  const settings = await getSettings(siteId);

  if (path.length === 2 && path[0] === settings.post_base) {
    const single = await loadSinglePost(siteId, path[1]);
    if (!single) return null;
    return render(await loadActive(), "single", single);
  }

  if (path.length === 1) {
    const p = await loadPage(siteId, path[0]);
    if (!p) return null;
    return render(await loadActive(), "page", { page: p });
  }

  if (path.length === 2 && (await getTaxonomy(siteId, path[0]))) {
    const archive = await loadArchive(siteId, path[0], path[1], page);
    if (!archive) return null;
    return render(await loadActive(), "archive", archive);
  }

  return null;
}

export async function renderSearch(query: string): Promise<ReactElement> {
  const loaded = await loadActive();
  const results = query.trim() ? await searchContent(loaded.siteId, query, { limit: 20 }) : [];
  return render(loaded, "search", {
    query,
    results: results.map((r) => ({ kind: r.kind, id: r.id, title: r.title, url: r.url, excerpt: r.excerpt })),
  });
}

export async function renderNotFound(): Promise<ReactElement> {
  return render(await loadActive(), "404", {});
}
