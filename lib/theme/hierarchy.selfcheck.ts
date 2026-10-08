/** ponytail: run with `npx tsx lib/theme/hierarchy.selfcheck.ts` */
import { resolveTemplate, templateCandidates } from "./hierarchy";

const set = (...n: string[]) => new Set(n);
const all = set("index", "home", "front-page", "single", "single-product", "page", "page-about", "archive", "category", "search", "404", "page-wide", "singular", "taxonomy-genre");

const eq = (a: unknown, b: unknown, msg: string) => console.assert(JSON.stringify(a) === JSON.stringify(b), `${msg}: got ${JSON.stringify(a)}`);

// candidate order
eq(templateCandidates({ kind: "home" }), ["front-page", "home", "index"], "home");
eq(templateCandidates({ kind: "single", type: "post", slug: "x" }), ["single-post-x", "single-post", "single", "singular", "index"], "single");
eq(templateCandidates({ kind: "page", slug: "about" }), ["page-about", "page", "singular", "index"], "page");
eq(templateCandidates({ kind: "archive", taxonomy: "category", term: "news" }).slice(0, 3), ["category-news", "category", "taxonomy-category-news"], "category archive");
eq(templateCandidates({ kind: "archive", taxonomy: "genre", term: "sci" }).slice(0, 2), ["taxonomy-genre-sci", "taxonomy-genre"], "custom taxonomy archive");

// resolution against what a theme provides
eq(resolveTemplate(templateCandidates({ kind: "home" }), all), "front-page", "front-page beats home");
eq(resolveTemplate(templateCandidates({ kind: "home" }), set("index", "home")), "home", "home");
eq(resolveTemplate(templateCandidates({ kind: "single", type: "product", slug: "x" }), all), "single-product", "CPT single");
eq(resolveTemplate(templateCandidates({ kind: "single", type: "post", slug: "x" }), all), "single", "post single");
eq(resolveTemplate(templateCandidates({ kind: "page", slug: "about" }), all), "page-about", "slug-specific page");
eq(resolveTemplate(templateCandidates({ kind: "page", slug: "contact" }), all), "page", "plain page");
eq(resolveTemplate(templateCandidates({ kind: "archive", taxonomy: "category", term: "news" }), all), "category", "category archive");
eq(resolveTemplate(templateCandidates({ kind: "archive", taxonomy: "tag", term: "x" }), all), "archive", "tag archive falls to archive");
eq(resolveTemplate(templateCandidates({ kind: "archive", taxonomy: "genre", term: "sci" }), all), "taxonomy-genre", "custom taxonomy");
eq(resolveTemplate(templateCandidates({ kind: "search" }), all), "search", "search");
eq(resolveTemplate(templateCandidates({ kind: "404" }), all), "404", "404");
eq(resolveTemplate(templateCandidates({ kind: "single", type: "post", slug: "x" }), set("index")), "index", "everything falls back to index");
eq(resolveTemplate(templateCandidates({ kind: "page", slug: "x" }), set("index", "singular")), "singular", "singular shared by page and single");

// overrides
eq(resolveTemplate(templateCandidates({ kind: "page", slug: "contact" }), all, { page: "page-wide" }), "page-wide", "override replaces a hierarchy name");
eq(resolveTemplate(templateCandidates({ kind: "page", slug: "about" }), all, { page: "page-wide" }), "page-about", "more specific template still wins");
eq(resolveTemplate(templateCandidates({ kind: "page", slug: "about" }), all, { "page-about": "page-wide" }), "page-wide", "override of the specific name");
eq(resolveTemplate(templateCandidates({ kind: "page", slug: "x" }), all, { page: "ghost" }), "page", "override to a missing template is ignored");

console.log("hierarchy self-check passed");
