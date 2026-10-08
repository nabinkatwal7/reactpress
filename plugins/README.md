# ReactPress plugin format

A plugin is a folder under `plugins/` with a manifest and a `register.ts` entry that hooks into
ReactPress through the plugin API. The machine-checked rules live in
[`lib/plugins/manifest.ts`](../lib/plugins/manifest.ts); this page is the human version.

```
plugins/<slug>/
  plugin.json    manifest (required)
  register.ts    entry: default-exports register(api) (required)
  ...            any other files your code imports
```

## Rules

1. **Folder name = slug.** Kebab-case (`my-plugin`). It must match `slug` in `plugin.json`.
2. **`plugin.json` is strict.** Required: `name`, `slug`, `version` (semver `1.2.3`), `author`.
   Optional: `description`, `settings`, `adminPages`.
3. **`register.ts` must `export default function register(api)`.** It runs when the plugin is
   active (on boot and after activation). Everything the plugin does goes through `api`; there is
   no other supported way to change ReactPress behaviour.
4. **Settings.** Declare fields in `settings`: `{ key, label, type, default }`, with the same
   types as theme customizer settings (`color`, `text`, `image`, `select`, `checkbox`). Keys are
   `snake_case` and unique. ReactPress renders the settings screen and stores the values per site.
5. **Admin pages.** List them in `adminPages` (`{ slug, title }`) and supply the component with
   `api.registerAdminPage(slug, component)`. They appear under `/admin/plugins/<slug>/<page>` and
   in the sidebar while the plugin is active. A page is a plain server function receiving
   `{ siteId, settings }` (no hooks or client state); put JSX in a `.tsx` file next to `register.ts`.
   Settings: ReactPress generates a form at `/admin/plugins/<slug>` from the `settings` fields.
   Read them with `await api.getSettings()` inside handlers, never at register time (they can change).
6. **Hooks.** `api.addAction(name, fn, priority?)` and `api.addFilter(name, fn, priority?)`.
   Handlers are removed automatically when the plugin is deactivated.
7. **Sandbox.** Plugins reach data and files only through `api` (see below). Anything else is
   rejected when the plugin is installed.

## Checking a plugin

`validatePluginDir(dir)` returns every violation at once. The install API runs it before a plugin
can be installed, and `npx tsx lib/plugins/manifest.selfcheck.ts` checks the format rules.

## Sandbox

Plugins are code from this build that an admin chooses to install; ReactPress constrains them in
two ways. Be clear about the limit: this is **not** isolation from a hostile author, because
in-process JavaScript cannot be fully isolated. Review a plugin like core code before installing it.

**What the API gives you**

| API | What it does |
| --- | --- |
| `api.store` | Private JSON key/value storage per plugin and site: `get`, `set`, `delete`, `list(prefix)`. Keys match `[A-Za-z0-9._:-]{1,100}`, values are JSON up to 64 KB, up to 1000 keys. |
| `api.files` | Files in your own folder inside the upload dir (`storage/uploads/plugin-data/<site>/<slug>/`, not served publicly): `read`, `write`, `remove`, `list`. Paths are relative, `a/b.json` style, letters/digits/`._-` only. Files up to 2 MB. |
| `api.posts.list` | Published posts of the current site (id, title, slug, publishedAt), newest first, max 100. |
| `api.getSettings()` | Your declared settings. |

There is no database client: you cannot query other tables or other sites. Deleting a plugin removes
its settings, store and files.

**What is blocked** (checked by `validatePluginDir` on install, via `lib/plugins/scan.ts`)

- Imports outside the allow-list: `react`, `react/jsx-runtime`, `next/link`, `@/lib/blocks`,
  `@/lib/plugins/api`, `@/lib/plugins/admin-pages`, `@/lib/plugins/settings`, plus relative imports
  inside your own folder. So no `fs`, `child_process`, `@prisma/client`, `@/lib/prisma`, `@/auth`…
- `require()`, dynamic `import()` with a non-literal path, `eval`, `Function(...)`, `process`,
  `globalThis` / `global`. The scan is textual, so avoid these words even in comments.
- Unsafe file paths at runtime: `..`, absolute paths, backslashes, drive letters, empty segments
  and symlinks that leave your folder all throw.
