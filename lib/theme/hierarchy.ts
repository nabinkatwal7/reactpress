/**
 * Template hierarchy: for every kind of public request, the ordered list of template names a
 * theme is asked for, most specific first. The first name the theme provides wins; `index`
 * is the last resort. Pure functions so they can be tested without a database.
 */

export type HierarchyInfo =
  | { kind: "home" }
  /** A static page set as the homepage. */
  | { kind: "front-page"; slug: string }
  | { kind: "single"; type: string; slug: string }
  | { kind: "page"; slug: string }
  | { kind: "archive"; taxonomy: string; term: string }
  | { kind: "search" }
  | { kind: "404" };

/** Taxonomies that also get a short name (`category-news`, `tag`) like WordPress. */
const SHORT_TAXONOMIES = new Set(["category", "tag"]);

export function templateCandidates(info: HierarchyInfo): string[] {
  switch (info.kind) {
    case "home":
      return ["front-page", "home", "index"];
    case "front-page":
      return ["front-page", `page-${info.slug}`, "page", "singular", "index"];
    case "single":
      return [`single-${info.type}-${info.slug}`, `single-${info.type}`, "single", "singular", "index"];
    case "page":
      return [`page-${info.slug}`, "page", "singular", "index"];
    case "archive": {
      const { taxonomy: t, term } = info;
      return [
        ...(SHORT_TAXONOMIES.has(t) ? [`${t}-${term}`, t] : []),
        `taxonomy-${t}-${term}`,
        `taxonomy-${t}`,
        "taxonomy",
        "archive",
        "index",
      ];
    }
    case "search":
      return ["search", "index"];
    case "404":
      return ["404", "index"];
  }
}

/**
 * Pick the template to render.
 * `available` are the names the theme actually provides; `overrides` maps a hierarchy name to
 * another template of the same theme ("when you would use `page`, use `page-wide`").
 */
export function resolveTemplate(
  candidates: string[],
  available: ReadonlySet<string>,
  overrides: Readonly<Record<string, string>> = {},
): string {
  for (const name of candidates) {
    const target = overrides[name];
    if (target && available.has(target)) return target;
    if (available.has(name)) return name;
  }
  return "index";
}
