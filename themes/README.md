# ReactPress theme format

A theme is a folder under `themes/` that bundles a manifest, React template
components, template parts and static assets. The machine-checked rules live in
[`lib/theme/manifest.ts`](../lib/theme/manifest.ts); this page is the human version.

```
themes/<slug>/
  theme.json          manifest (required)
  index.ts            entry: default-exports the theme module (required)
  templates/<name>.tsx  one file per template declared in theme.json
  parts/header.tsx    optional template parts (header, footer)
  parts/footer.tsx
  assets/             static files served at /theme-assets/<slug>/<file>
```

## Rules

1. **Folder name = slug.** Kebab-case (`my-theme`). It must match `slug` in `theme.json`.
2. **`theme.json` is strict.** Required: `name`, `slug`, `version` (semver `1.2.3`), `author`,
   `templates`. Optional: `description`, `parts`, `screenshot` (a file directly in `assets/`),
   `customizer`.
3. **`index` template is mandatory.** It is the last fallback of the template hierarchy
   (home, single, page, archive, search and 404 all fall back to it).
4. **Every declared template/part must exist** as `templates/<name>.tsx` / `parts/<name>.tsx`.
   Template names are kebab-case. Names matching the hierarchy (`home`, `front-page`, `single`,
   `single-<type>`, `single-<type>-<slug>`, `page`, `page-<slug>`, `singular`, `archive`,
   `category`, `tag`, `taxonomy-<tax>`, `search`, `404`) are picked automatically. Any other name
   (for example `page-wide`) is only used when a site override points at it.
5. **Entry module.** `index.ts` must `export default` an object `{ templates, parts }` mapping each
   declared name to its component. Keep imports static so the bundler can see them.
6. **Components are server components by default.** They receive typed props (see
   `lib/theme/types.ts`). Render user text as text, never with `dangerouslySetInnerHTML`.
7. **Parts.** `header` and `footer` wrap every page. They receive the theme context (site title,
   tagline, menus, customizer values, editable part content).
8. **Customizer.** Declare settings in `customizer.settings`: `{ key, label, type, default }`.
   Types: `color` (`#rrggbb`), `text`, `image` (media URL), `select` (needs `options`),
   `checkbox`. Keys are `snake_case` and unique. Read values from `ctx.mods`; always handle the
   default case.
9. **Assets** live only in `assets/` and are referenced as `/theme-assets/<slug>/<file>`.
   No assets outside that folder, no path tricks (`..`).
10. **Internal links.** A site can be served under a path prefix (`/shop/...`). Use
    `<SiteLink href="/search">` from `components/public/site-link` (or prefix with `ctx.basePath`)
    for links you write yourself; URLs that arrive in props (menus, posts, terms, search results)
    are already prefixed. Never hard-code `/search`, `/admin` or `/`.
11. **No server-only secrets, no network calls** in templates. Data arrives through props.

## Checking a theme

`validateThemeDir(dir)` returns every violation at once. The install API runs it before a theme
can be installed, and `npx tsx lib/theme/manifest.selfcheck.ts` checks the shipped themes.
